import UIKit
import WebKit
import CoreFoundation
import CryptoKit

@MainActor
private final class NativeMessageProxy: NSObject, WKScriptMessageHandlerWithReply {
    weak var owner: StudioViewController?
    init(owner: StudioViewController) { self.owner = owner }
    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage, replyHandler: @escaping (Any?, String?) -> Void) {
        guard let owner else { replyHandler(nil, "Editor closed"); return }
        owner.userContentController(controller, didReceive: message, replyHandler: replyHandler)
    }
}

final class StudioViewController: UIViewController, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandlerWithReply, UIDocumentPickerDelegate, UIAdaptivePresentationControllerDelegate {
    private var webView: WKWebView!
    private var server: AssetServer?
    private var networkProbe: AssetServer?
    private var exports: ExportStore?
    private var exportReply: ((Any?, String?) -> Void)?
    private var activeExportPicker: UIDocumentPickerViewController?
    private var exportCompleting = false
    private var exportTimeout: Timer?
    private var dismissJavaScriptDialog: (() -> Void)?
    private var modalAccessibilityStates: [ObjectIdentifier: Bool] = [:]
    private var previousWebAccessibilityHidden: Bool?
    private var lastSmokeExport: [String: Any]?
    private var trustedOrigin: URL?
    private let status = UILabel()
    private let retry = UIButton(type: .system)
    #if DEBUG && targetEnvironment(simulator)
    private let smoke = ProcessInfo.processInfo.arguments.contains("--smoke")
    #else
    private let smoke = false
    #endif
    private var smokeStarted = false
    private var smokeReported = false
    private var smokeStage = "Native app startup"
    private var smokeHistory: [[String: String]] = []
    private var smokeWatchdog: Timer?
    private var startingServer = false

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground
        if smoke {
            recordSmokeProgress("Native app startup")
            smokeWatchdog = Timer.scheduledTimer(withTimeInterval: 240, repeats: false) { [weak self] _ in
                guard let self else { return }
                self.writeSmoke(["passed": false, "error": "Native smoke watchdog reached 240 seconds", "activeStage": self.smokeStage])
            }
        }
        let controller = WKUserContentController()
        controller.addScriptMessageHandler(NativeMessageProxy(owner: self), contentWorld: .page, name: "figureStudioNative")
        guard let scriptURL = Bundle.main.url(forResource: "native-adapter", withExtension: "js"),
              let script = try? String(contentsOf: scriptURL, encoding: .utf8) else { showError("Missing native adapter"); return }
        controller.addUserScript(WKUserScript(source: script, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        let config = WKWebViewConfiguration()
        config.userContentController = controller
        // Test projects never share the user's normal storage, including on relaunch.
        config.websiteDataStore = smoke ? WKWebsiteDataStore(forIdentifier: UUID(uuidString: "44BD0F96-89D4-4DA6-A3CC-8054C88E2B33")!) : .default()
        config.preferences.javaScriptCanOpenWindowsAutomatically = false
        webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.isOpaque = false
        webView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(webView)
        NSLayoutConstraint.activate([
            webView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            webView.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor),
            webView.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor)
        ])
        status.text = "Opening local editor… / 正在打开本地编辑器…"
        status.numberOfLines = 0
        status.font = .preferredFont(forTextStyle: .body)
        status.textAlignment = .center
        status.backgroundColor = .systemBackground
        status.accessibilityIdentifier = "native-status"
        status.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(status)
        NSLayoutConstraint.activate([status.centerYAnchor.constraint(equalTo: view.centerYAnchor), status.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 20), status.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -20)])
        retry.setTitle("Retry / 重试", for: .normal)
        retry.addTarget(self, action: #selector(reloadEditor), for: .touchUpInside)
        retry.isHidden = true; retry.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(retry)
        NSLayoutConstraint.activate([retry.topAnchor.constraint(equalTo: status.bottomAnchor, constant: 16), retry.centerXAnchor.constraint(equalTo: view.centerXAnchor), retry.heightAnchor.constraint(greaterThanOrEqualToConstant: 44)])
        do { exports = try ExportStore() } catch { showError(error.localizedDescription); return }
        do { try FileManager.default.createDirectory(at: localDocumentsDirectory, withIntermediateDirectories: true) } catch { showError(error.localizedDescription, canRetry: false); return }
        // Imported data and editor storage remain app-local rather than entering iCloud backup.
        excludeEditorStorageFromBackup()
        startServer()
    }

    private func excludeEditorStorageFromBackup() {
        let fm = FileManager.default
        for base in [fm.urls(for: .libraryDirectory, in: .userDomainMask).first?.appendingPathComponent("WebKit", isDirectory: true), fm.urls(for: .documentDirectory, in: .userDomainMask).first] {
            guard var url = base else { continue }
            try? fm.createDirectory(at: url, withIntermediateDirectories: true)
            var values = URLResourceValues(); values.isExcludedFromBackup = true
            try? url.setResourceValues(values)
        }
    }

    private var localDocumentsDirectory: URL {
        FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
    }

    private func startServer() {
        guard !startingServer else { return }
        guard let assets = Bundle.main.url(forResource: "WebAssets", withExtension: nil) else { showError("Missing bundled assets / 缺少本地资源", canRetry: false); return }
        startingServer = true; retry.isEnabled = false
        recordSmokeProgress("Starting loopback asset server")
        let local = AssetServer(root: assets)
        server = local
        local.start { [weak self] result in
            guard let self else { return }
            self.startingServer = false
            switch result {
            case .failure(let error):
                self.showError("Could not open the saved local port. Close and reopen the app to retry; your project storage has not been reset. / 无法打开原本地端口，请关闭应用后重试，项目存储未被重置。\n" + error.localizedDescription)
            case .success(let url):
                self.recordSmokeProgress("Installing local-first WebKit policy")
                self.trustedOrigin = url
                self.installNetworkRules(origin: local.origin) { self.webView.load(URLRequest(url: url)) }
            }
        }
    }

    private func installNetworkRules(origin: String, ready: @escaping () -> Void) {
        // Imported artwork cannot load remote assets. Only credential-free
        // literature fetches are exempted; data and computation remain local.
        let localPattern = "^" + NSRegularExpression.escapedPattern(for: origin + "/")
        var rules: [[String: Any]] = [
            // WebKit content-blocker patterns are a restricted regex subset:
            // alternation is unsupported, so use independent scheme rules.
            ["trigger": ["url-filter": "^https?://"], "action": ["type": "block"]],
            ["trigger": ["url-filter": "^wss?://"], "action": ["type": "block"]],
            ["trigger": ["url-filter": localPattern], "action": ["type": "ignore-previous-rules"]]
        ]
        rules += LiteraturePolicy.lookupPatterns.map { pattern in
            ["trigger": ["url-filter": pattern, "resource-type": ["raw"]], "action": ["type": "ignore-previous-rules"]]
        }
        guard let data = try? JSONSerialization.data(withJSONObject: rules), let text = String(data: data, encoding: .utf8) else { showError("Could not create local resource policy"); return }
        WKContentRuleListStore.default().compileContentRuleList(forIdentifier: "figure-studio-local-with-literature-v1", encodedContentRuleList: text) { [weak self] list, error in
            guard let self else { return }
            guard let list else {
                let detail = (error as NSError?)?.userInfo[NSLocalizedFailureReasonErrorKey] as? String
                self.showError((error?.localizedDescription ?? "Local resource policy unavailable") + (detail.map { "\n" + $0 } ?? ""))
                return
            }
            self.webView.configuration.userContentController.add(list)
            self.recordSmokeProgress("Loading bundled editor")
            ready()
        }
    }

    private func isTrusted(_ url: URL?) -> Bool {
        guard let url, let origin = trustedOrigin else { return false }
        return url.scheme == "http" && url.host == "127.0.0.1" && url.port == origin.port && url.user == nil && url.password == nil
    }

    private func isolateModalAccessibility(_ controller: UIViewController) {
        let key = ObjectIdentifier(controller)
        guard modalAccessibilityStates[key] == nil else { return }
        if modalAccessibilityStates.isEmpty { previousWebAccessibilityHidden = webView.accessibilityElementsHidden }
        modalAccessibilityStates[key] = controller.view.accessibilityViewIsModal
        // A synchronous JavaScript confirm suspends WebKit. Keep assistive
        // technology on the native modal instead of querying that background.
        // Only the web content is hidden; the native modal stays accessible.
        webView.accessibilityElementsHidden = true
        controller.view.accessibilityViewIsModal = true
    }

    private func restoreModalAccessibility(_ controller: UIViewController) {
        guard let previous = modalAccessibilityStates.removeValue(forKey: ObjectIdentifier(controller)) else { return }
        controller.view.accessibilityViewIsModal = previous
        guard modalAccessibilityStates.isEmpty else { return }
        webView.accessibilityElementsHidden = previousWebAccessibilityHidden ?? false
        previousWebAccessibilityHidden = nil
        DispatchQueue.main.async { [weak self] in
            guard let self, self.modalAccessibilityStates.isEmpty else { return }
            UIAccessibility.post(notification: .screenChanged, argument: nil)
        }
    }

    private func dismissAccessibleModal(_ controller: UIViewController, completion: @escaping () -> Void = {}) {
        var completed = false
        let finish: () -> Void = { [weak self] in
            guard !completed else { return }
            completed = true
            // Resolve a synchronous confirm before WebKit re-enters the AX tree.
            completion()
            self?.restoreModalAccessibility(controller)
        }
        // UIKit may already be presenting/dismissing after an action or swipe.
        // Wait for the real transition before exposing the background again.
        if (controller.isBeingPresented || controller.isBeingDismissed), let transition = controller.transitionCoordinator {
            // animate can return false and still call its completion later.
            // Only one continuation may own dismissal and the eventual reply.
            var continuationClaimed = false
            if transition.animate(alongsideTransition: nil, completion: { [weak self] _ in
                guard !continuationClaimed else { return }
                continuationClaimed = true
                guard let self else { finish(); return }
                self.dismissAccessibleModal(controller, completion: finish)
            }) { return }
            guard !continuationClaimed else { return }
            continuationClaimed = true
        }
        if controller.presentingViewController != nil {
            controller.dismiss(animated: false, completion: finish)
        } else {
            finish()
        }
    }

    private func showError(_ text: String, canRetry: Bool = true) {
        // A missing adapter is detected before the regular view setup. Still
        // show that fatal setup error, without an ineffective Retry action.
        if status.superview == nil {
            status.numberOfLines = 0; status.textAlignment = .center
            status.font = .preferredFont(forTextStyle: .body)
            status.accessibilityIdentifier = "native-status"
            status.translatesAutoresizingMaskIntoConstraints = false
            view.addSubview(status)
            NSLayoutConstraint.activate([status.centerYAnchor.constraint(equalTo: view.centerYAnchor), status.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 20), status.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -20)])
        }
        status.isHidden = false; status.text = text; retry.isHidden = !canRetry || webView == nil || exports == nil; retry.isEnabled = true
        if smoke { writeSmoke(["passed": false, "error": text, "activeStage": smokeStage]) }
    }

    @objc private func reloadEditor() {
        guard !startingServer, webView != nil, exports != nil else { return }
        dismissJavaScriptDialog?()
        if exportReply != nil { dismiss(animated: false); completeExport(cancelled: true) }
        exports?.abort()
        webView.stopLoading()
        retry.isHidden = true; status.text = "Opening local editor… / 正在打开本地编辑器…"
        let previous = server; server = nil; trustedOrigin = nil
        let restart: () -> Void = { [weak self] in self?.startServer() }
        if let previous { previous.stop(completion: restart) } else { restart() }
    }

    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        if let paper = externalPaperLink(action) {
            // A target=_blank link is handled by createWebViewWith below. No
            // remote page is ever loaded into the editor's trusted WebView.
            if action.targetFrame == nil { decisionHandler(.allow); return }
            if action.targetFrame?.isMainFrame == true { openPaper(paper) }
            decisionHandler(.cancel); return
        }
        let allowed = isTrusted(action.request.url) && (action.targetFrame?.isMainFrame == true) && ["/", "/index.html", "/starter.html"].contains(action.request.url?.path ?? "")
        decisionHandler(allowed ? .allow : .cancel)
    }
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for action: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if action.targetFrame == nil, let paper = externalPaperLink(action) { openPaper(paper) }
        return nil
    }
    private func externalPaperLink(_ action: WKNavigationAction) -> URL? {
        guard action.navigationType == .linkActivated, action.sourceFrame.isMainFrame,
              isTrusted(action.sourceFrame.request.url), isTrusted(webView.url),
              LiteraturePolicy.isPaperLink(action.request.url) else { return nil }
        return action.request.url
    }
    private func openPaper(_ url: URL) {
        UIApplication.shared.open(url, options: [:]) { [weak self] opened in
            guard !opened, let self else { return }
            let notice = UIAlertController(title: "Figure Studio", message: "Could not open the paper. Please try again. / 无法打开论文，请重试。", preferredStyle: .alert)
            notice.addAction(UIAlertAction(title: "OK / 好", style: .default))
            if self.presentedViewController == nil { self.present(notice, animated: true) }
        }
    }
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) { if (error as NSError).code != NSURLErrorCancelled { showError(error.localizedDescription) } }
    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) { if (error as NSError).code != NSURLErrorCancelled { showError(error.localizedDescription) } }
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        dismissJavaScriptDialog?()
        if let picker = activeExportPicker { dismissAccessibleModal(picker) }
        exports?.abort(); exportReply?(nil, "The editor process restarted; retry the export / 编辑器进程已重启，请重试导出"); exportReply = nil
        activeExportPicker = nil; exportCompleting = false
        showError("The system stopped the editor to recover memory. Reopen the saved local project or retry. / 系统为释放内存暂停了编辑器，请重试或重新打开已保存项目。")
    }

    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        if smoke {
            recordSmokeProgress("Native confirmation requested; mainFrame=\(frame.isMainFrame); trustedFrame=\(isTrusted(frame.request.url)); trustedPage=\(isTrusted(webView.url)); exportActive=\(exportReply != nil); dialogActive=\(dismissJavaScriptDialog != nil); presenter=" + (presentedViewController.map { String(describing: type(of: $0)) } ?? "none") + "; dismissing=" + String(presentedViewController?.isBeingDismissed ?? false))
        }
        guard frame.isMainFrame, isTrusted(frame.request.url), isTrusted(webView.url), exportReply == nil, dismissJavaScriptDialog == nil else {
            if smoke { recordSmokeProgress("Native confirmation rejected by origin or active-dialog guard") }
            completionHandler(false); return
        }
        let chinese = message.range(of: "\\p{Han}", options: .regularExpression) != nil
        let dialog = UIAlertController(title: "Figure Studio", message: message, preferredStyle: .alert)
        var resolved = false
        let finish: (Bool) -> Void = { [weak self, weak dialog] accepted in
            guard !resolved else { return }
            resolved = true
            let complete: () -> Void = { [weak self] in
                self?.dismissJavaScriptDialog = nil
                if self?.smoke == true { self?.recordSmokeProgress(accepted ? "Native confirmation accepted" : "Native confirmation declined") }
                completionHandler(accepted)
            }
            if let self, let dialog { self.dismissAccessibleModal(dialog, completion: complete) }
            else { complete() }
        }
        dismissJavaScriptDialog = { finish(false) }
        dialog.addAction(UIAlertAction(title: chinese ? "取消" : "Cancel", style: .cancel) { _ in finish(false) })
        dialog.addAction(UIAlertAction(title: chinese ? "确认" : "Confirm", style: .default) { _ in finish(true) })
        isolateModalAccessibility(dialog)
        presentConfirmationWhenReady(dialog, attemptsRemaining: 20, isActive: { !resolved }, finish: finish)
    }

    private func presentConfirmationWhenReady(_ dialog: UIAlertController, attemptsRemaining: Int, mayDismissCompletedPicker: Bool = true, isActive: @escaping () -> Bool, finish: @escaping (Bool) -> Void) {
        guard isActive() else { return }
        guard isTrusted(webView.url), viewIfLoaded?.window != nil else { finish(false); return }
        if presentedViewController == nil {
            present(dialog, animated: !UIAccessibility.isReduceMotionEnabled) { [weak self] in
                if self?.smoke == true { self?.recordSmokeProgress("Native confirmation shown") }
                UIAccessibility.post(notification: .screenChanged, argument: dialog.view)
            }
        } else if attemptsRemaining > 0 {
            // File input onchange can run while the system picker is finishing
            // dismissal. Wait briefly for that transition, rather than declining
            // a valid project import or presenting over another controller.
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) { [weak self] in
                guard let self else { finish(false); return }
                self.presentConfirmationWhenReady(dialog, attemptsRemaining: attemptsRemaining - 1, mayDismissCompletedPicker: mayDismissCompletedPicker, isActive: isActive, finish: finish)
            }
        } else if mayDismissCompletedPicker, exportReply == nil, activeExportPicker == nil,
                  let picker = presentedViewController as? UIDocumentPickerViewController, !picker.isBeingDismissed {
            // A trusted project confirmation means the editor already received
            // and validated the file. Recover only a leftover import picker;
            // never close an export dialog or an unrelated presented controller.
            if smoke { recordSmokeProgress("Closing completed import picker before native confirmation") }
            picker.dismiss(animated: false) { [weak self] in
                guard let self else { finish(false); return }
                self.presentConfirmationWhenReady(dialog, attemptsRemaining: 0, mayDismissCompletedPicker: false, isActive: isActive, finish: finish)
            }
        } else {
            if smoke { recordSmokeProgress("Native confirmation could not show while prior controller remained presented") }
            finish(false)
        }
    }
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        status.isHidden = true; retry.isHidden = true
        recordSmokeProgress("Editor page loaded; starting JavaScript checks")
        excludeEditorStorageFromBackup()
        guard smoke, !smokeStarted,
              let url = Bundle.main.url(forResource: "simulator-smoke", withExtension: "js"),
              let source = try? String(contentsOf: url, encoding: .utf8) else { return }
        smokeStarted = true
        let mode = ProcessInfo.processInfo.arguments.contains("--restore") ? "true" : "false"
        webView.evaluateJavaScript("window.__studioSimulatorRestore = \(mode);\n" + source) { [weak self] _, error in if let error { self?.writeSmoke(["passed": false, "error": error.localizedDescription]) } }
    }

    private func resetExportTimeout() {
        exportTimeout?.invalidate()
        exportTimeout = Timer.scheduledTimer(withTimeInterval: 60, repeats: false) { [weak self] _ in
            guard let self, self.exportReply == nil else { return }
            self.exports?.abort()
        }
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage, replyHandler: @escaping (Any?, String?) -> Void) {
        guard message.frameInfo.isMainFrame, isTrusted(message.frameInfo.request.url), isTrusted(webView.url),
              let origin = trustedOrigin, message.frameInfo.securityOrigin.protocol == "http",
              message.frameInfo.securityOrigin.host == "127.0.0.1", message.frameInfo.securityOrigin.port == origin.port,
              let body = message.body as? [String: Any], let action = body["action"] as? String else {
            if smoke { writeSmoke(["passed": false, "error": "Untrusted native request", "frameURL": message.frameInfo.request.url?.absoluteString ?? "nil", "webURL": webView.url?.absoluteString ?? "nil", "securityOrigin": "\(message.frameInfo.securityOrigin.protocol)://\(message.frameInfo.securityOrigin.host):\(message.frameInfo.securityOrigin.port)"] ) }
            replyHandler(nil, "Untrusted native request"); return
        }
        do {
            guard let exports else { throw ExportFailure.invalid("Native export is unavailable") }
            switch action {
            case "begin":
                guard exportReply == nil, let name = body["name"] as? String,
                      let number = body["bytes"] as? NSNumber, CFGetTypeID(number) != CFBooleanGetTypeID(),
                      number.doubleValue.isFinite, number.doubleValue.rounded() == number.doubleValue,
                      number.doubleValue >= 0, number.doubleValue <= Double(ExportStore.maximumBytes) else { throw ExportFailure.invalid("Invalid export size") }
                let id = try exports.begin(name: name, bytes: number.intValue)
                if smoke { lastSmokeExport = nil }
                resetExportTimeout(); replyHandler(["id": id], nil)
            case "chunk":
                guard let id = body["id"] as? String, let index = body["index"] as? Int, let base64 = body["base64"] as? String else { throw ExportFailure.invalid("Invalid export chunk") }
                let bytes = try exports.append(id: id, index: index, base64: base64)
                resetExportTimeout(); replyHandler(["bytes": bytes], nil)
            case "abort":
                guard let id = body["id"] as? String else { throw ExportFailure.invalid("Missing export ID") }
                guard exportReply == nil else { throw ExportFailure.invalid("Close the save dialog to cancel") }
                exports.abort(id: id); exportTimeout?.invalidate(); replyHandler(["cancelled": true], nil)
            case "finish":
                guard exportReply == nil, dismissJavaScriptDialog == nil, let id = body["id"] as? String else { throw ExportFailure.invalid("An export dialog is already open") }
                let file = try exports.finish(id: id)
                exportTimeout?.invalidate(); exportReply = replyHandler; exportCompleting = false
                let picker = UIDocumentPickerViewController(forExporting: [file], asCopy: true)
                activeExportPicker = picker
                picker.delegate = self
                picker.modalPresentationStyle = .formSheet
                // Keep Files' registered destination rather than force a raw
                // sandbox URL. The user still explicitly chooses where to save.
                presentExportWhenReady(picker, id: id, attemptsRemaining: 20)
            case "smokeLastExport" where smoke:
                replyHandler(lastSmokeExport ?? ["saved": false], nil)
            case "smokeStage" where smoke:
                guard let stage = body["stage"] as? String, stage.utf8.count <= 500 else { throw ExportFailure.invalid("Invalid smoke stage") }
                recordSmokeProgress(stage); replyHandler(["recorded": true], nil)
            case "smokeStartNetworkProbe" where smoke:
                guard networkProbe == nil, let root = Bundle.main.url(forResource: "WebAssets", withExtension: nil) else { throw ExportFailure.invalid("Probe already active") }
                let probe = AssetServer(root: root, persistPort: false); networkProbe = probe
                probe.start { result in
                    switch result {
                    case .success(let url): replyHandler(["url": url.absoluteString], nil)
                    case .failure(let error): replyHandler(nil, error.localizedDescription)
                    }
                }
            case "smokeFinishNetworkProbe" where smoke:
                guard let probe = networkProbe else { throw ExportFailure.invalid("No active probe") }
                probe.snapshot { [weak self] requests, rejected in
                    probe.stop(); self?.networkProbe = nil
                    replyHandler(["requests": requests, "rejected": rejected], nil)
                }
            case "smokeComplete" where smoke:
                guard let report = body["report"] as? [String: Any] else { throw ExportFailure.invalid("Invalid test report") }
                writeSmoke(report); replyHandler(["written": true], nil)
            default: throw ExportFailure.invalid("Unknown native operation")
            }
        } catch {
            if ["chunk", "finish"].contains(action), exportReply == nil, let id = body["id"] as? String, id == exports?.id { exports?.abort(); exportTimeout?.invalidate() }
            replyHandler(nil, error.localizedDescription)
        }
    }

    func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
        guard controller === activeExportPicker else { return }
        completeExport(cancelled: true)
    }
    func presentationControllerDidDismiss(_ presentationController: UIPresentationController) {
        guard presentationController.presentedViewController === activeExportPicker else { return }
        completeExport(cancelled: true)
    }
    private func presentExportWhenReady(_ picker: UIDocumentPickerViewController, id: String, attemptsRemaining: Int) {
        guard exportReply != nil, exports?.id == id else { return }
        guard viewIfLoaded?.window != nil else {
            let callback = exportReply; exportReply = nil; activeExportPicker = nil
            exports?.abort(); exportTimeout?.invalidate()
            dismissAccessibleModal(picker) {
                callback?(nil, "The editor is not visible; reopen it and retry saving / 编辑器未显示，请重新打开后保存")
            }
            return
        }
        if presentedViewController == nil {
            let file = exports?.file
            let values = try? file?.resourceValues(forKeys: [.fileSizeKey, .isRegularFileKey])
            let readable = file.map { FileManager.default.isReadableFile(atPath: $0.path) } ?? false
            if smoke {
                recordSmokeProgress("Presenting native export; source=" + (file?.path ?? "missing") + "; readable=\(readable); regular=\(values?.isRegularFile == true); bytes=\(values?.fileSize ?? -1); expected=\(exports?.written ?? -1); destination=Files registered location")
            }
            guard readable, values?.isRegularFile == true, values?.fileSize == exports?.written else {
                let callback = exportReply; exportReply = nil; activeExportPicker = nil
                exports?.abort(); exportTimeout?.invalidate()
                callback?(nil, "The prepared export file is no longer complete; retry saving / 导出临时文件不完整，请重试保存")
                return
            }
            isolateModalAccessibility(picker)
            present(picker, animated: !UIAccessibility.isReduceMotionEnabled) {
                UIAccessibility.post(notification: .screenChanged, argument: picker.view)
            }
            picker.presentationController?.delegate = self
        } else if attemptsRemaining > 0 {
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) { [weak self] in
                self?.presentExportWhenReady(picker, id: id, attemptsRemaining: attemptsRemaining - 1)
            }
        } else {
            let callback = exportReply; exportReply = nil; activeExportPicker = nil
            exports?.abort(); exportTimeout?.invalidate()
            callback?(nil, "The previous dialog is still closing; retry saving / 上一个窗口尚未关闭，请重试保存")
        }
    }
    func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
        guard controller === activeExportPicker else { return }
        if let url = urls.first {
            if smoke {
                let scoped = url.startAccessingSecurityScopedResource()
                defer { if scoped { url.stopAccessingSecurityScopedResource() } }
                var coordinationError: NSError?
                NSFileCoordinator().coordinate(readingItemAt: url, options: [], error: &coordinationError) { actual in
                    do {
                        let bytes = try Data(contentsOf: actual)
                        lastSmokeExport = ["saved": true, "name": actual.lastPathComponent, "bytes": bytes.count, "sha256": SHA256.hash(data: bytes).map { String(format: "%02x", $0) }.joined(), "coordinatedReadback": true, "destinationURL": actual.absoluteString, "insideLocalDocuments": actual.standardizedFileURL.resolvingSymlinksInPath().path.hasPrefix(localDocumentsDirectory.standardizedFileURL.resolvingSymlinksInPath().path + "/")]
                    } catch { lastSmokeExport = ["saved": false, "error": error.localizedDescription] }
                }
                if let coordinationError { lastSmokeExport = ["saved": false, "error": coordinationError.localizedDescription] }
            }
        }
        completeExport(cancelled: urls.isEmpty)
    }
    private func completeExport(cancelled: Bool) {
        guard exportReply != nil, !exportCompleting, let picker = activeExportPicker else { return }
        exportCompleting = true
        let result: [String: Any] = cancelled ? ["cancelled": true] : ["saved": true, "name": exports?.file?.lastPathComponent ?? "", "bytes": exports?.written ?? 0]
        if smoke { recordSmokeProgress("Native export result received; waiting for picker dismissal; cancelled=\(cancelled)") }
        // The delegate may run before UIKit dismisses its file provider. Keep
        // the native Promise and busy state pending so the next file input or
        // export cannot begin underneath that transition.
        DispatchQueue.main.async { [weak self] in
            self?.finishExportAfterDismissal(picker, result: result, attemptsRemaining: 40, mayDismiss: true)
        }
    }

    private func finishExportAfterDismissal(_ picker: UIDocumentPickerViewController, result: [String: Any], attemptsRemaining: Int, mayDismiss: Bool) {
        guard exportCompleting, exportReply != nil, activeExportPicker === picker else { return }
        let closed = picker.presentingViewController == nil && !picker.isBeingDismissed && presentedViewController !== picker
        if closed || attemptsRemaining == 0 {
            let callback = exportReply; exportReply = nil; activeExportPicker = nil; exportCompleting = false
            exports?.abort(); exportTimeout?.invalidate()
            if smoke {
                recordSmokeProgress(closed ? "Native export picker closed before replying to JavaScript" : "Native export picker dismissal timed out")
                if closed, result["saved"] as? Bool == true { lastSmokeExport?["pickerClosedBeforeReply"] = true }
            }
            guard closed else {
                dismissAccessibleModal(picker) {
                    callback?(nil, "The file dialog did not finish closing; close it before continuing / 文件窗口尚未完成关闭，请关闭后继续")
                }
                return
            }
            restoreModalAccessibility(picker)
            var response = result
            if smoke { response["pickerClosedBeforeReply"] = true }
            callback?(response, nil)
        } else if mayDismiss && !picker.isBeingDismissed && presentedViewController === picker {
            // Only our completed export picker is dismissed. The completion
            // callback, or the bounded fallback below, checks actual detachment.
            picker.dismiss(animated: !UIAccessibility.isReduceMotionEnabled) { [weak self] in
                self?.finishExportAfterDismissal(picker, result: result, attemptsRemaining: 40, mayDismiss: false)
            }
            DispatchQueue.main.asyncAfter(deadline: .now() + 6) { [weak self] in
                self?.finishExportAfterDismissal(picker, result: result, attemptsRemaining: 0, mayDismiss: false)
            }
        } else {
            // UIKit may already own dismissal when didPick/cancel is called.
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) { [weak self] in
                self?.finishExportAfterDismissal(picker, result: result, attemptsRemaining: attemptsRemaining - 1, mayDismiss: false)
            }
        }
    }

    private func recordSmokeProgress(_ stage: String) {
        guard smoke else { return }
        smokeStage = stage
        smokeHistory.append(["stage": stage, "at": ISO8601DateFormatter().string(from: Date())])
        if smokeHistory.count > 64 { smokeHistory.removeFirst(smokeHistory.count - 64) }
        let target = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0].appendingPathComponent("simulator-progress.json")
        try? FileManager.default.createDirectory(at: target.deletingLastPathComponent(), withIntermediateDirectories: true)
        let value: [String: Any] = ["stage": stage, "at": ISO8601DateFormatter().string(from: Date()), "origin": server?.origin ?? "not-ready", "history": smokeHistory]
        if let data = try? JSONSerialization.data(withJSONObject: value, options: [.prettyPrinted, .sortedKeys]) { try? data.write(to: target, options: .atomic) }
    }

    private func writeSmoke(_ report: [String: Any]) {
        guard smoke, !smokeReported else { return }
        smokeReported = true; smokeWatchdog?.invalidate()
        var result = report
        result["platform"] = "iOS simulator (development build)"
        result["origin"] = server?.origin
        result["nativeStageHistory"] = smokeHistory
        result["nativeSecurityChecks"] = nativeSecurityChecks()
        if let checks = result["nativeSecurityChecks"] as? [String: Bool], checks.values.contains(false) { result["passed"] = false }
        let name = ProcessInfo.processInfo.arguments.contains("--restore") ? "simulator-restore.json" : "simulator-smoke.json"
        let target = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0].appendingPathComponent(name)
        try? FileManager.default.createDirectory(at: target.deletingLastPathComponent(), withIntermediateDirectories: true)
        if let data = try? JSONSerialization.data(withJSONObject: result, options: [.prettyPrinted, .sortedKeys]) { try? data.write(to: target, options: .atomic) }
        status.isHidden = false; status.text = result["passed"] as? Bool == true ? "SIMULATOR SMOKE PASSED" : "SIMULATOR SMOKE FAILED"
    }

    private func nativeSecurityChecks() -> [String: Bool] {
        let root = Bundle.main.bundleURL.appendingPathComponent("WebAssets")
        var result = [
            "rejectParentPath": AssetServer.assetURL(target: "/../Info.plist", root: root) == nil,
            "rejectEncodedParentPath": AssetServer.assetURL(target: "/%2e%2e/Info.plist", root: root) == nil,
            "rejectAbsoluteURL": AssetServer.assetURL(target: "https://example.invalid/", root: root) == nil,
            "rejectFilenameTraversal": (try? ExportStore.safeName("../private.txt")) == nil,
            "rejectRemoteNavigation": !isTrusted(URL(string: "https://example.invalid/")),
            "stableOriginPort": UserDefaults.standard.integer(forKey: "studio.local.port.v1") == Int(server?.port ?? 0),
            "backgroundAccessibilityRestored": modalAccessibilityStates.isEmpty && previousWebAccessibilityHidden == nil && !webView.accessibilityElementsHidden
        ]
        result.merge(LiteraturePolicy.selfChecks()) { _, current in current }
        let folder = FileManager.default.temporaryDirectory.appendingPathComponent("FigureStudioNativeSelfTest")
        do {
            let store = try ExportStore(directory: folder)
            let token = try store.begin(name: "test.txt", bytes: 7)
            result["rejectOutOfOrderChunk"] = (try? store.append(id: token, index: 1, base64: Data("abc".utf8).base64EncodedString())) == nil
            _ = try store.append(id: token, index: 0, base64: Data("abc".utf8).base64EncodedString())
            result["rejectIncompleteStream"] = (try? store.finish(id: token)) == nil
            _ = try store.append(id: token, index: 1, base64: Data("defg".utf8).base64EncodedString())
            let file = try store.finish(id: token)
            result["streamBytesPreserved"] = (try Data(contentsOf: file)) == Data("abcdefg".utf8)
            store.abort(); result["temporaryFileRemoved"] = !FileManager.default.fileExists(atPath: file.path)
            try? FileManager.default.removeItem(at: folder)
        } catch { result["nativeExportStore"] = false }
        return result
    }

    deinit {
        dismissJavaScriptDialog?(); dismissJavaScriptDialog = nil
        exportReply?(nil, "Editor closed / 编辑器已关闭"); exportReply = nil
        smokeWatchdog?.invalidate(); exportTimeout?.invalidate(); exports?.abort(); server?.stop(); networkProbe?.stop()
        webView?.configuration.userContentController.removeScriptMessageHandler(forName: "figureStudioNative", contentWorld: .page)
    }
}
