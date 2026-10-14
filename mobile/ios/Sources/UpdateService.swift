import Foundation

/// Version metadata has a dedicated native transport. This does not allow
/// GitHub requests, or arbitrary network requests, from the editor WebView.
enum StudioUpdatePolicy {
    static let releases = "https://github.com/zhoy0409-debug/polish-sci-figures/releases"
    static let endpoint = URL(string: "https://api.github.com/repos/zhoy0409-debug/polish-sci-figures/releases?per_page=30")!
    static let maximumBytes = 2 * 1024 * 1024

    static func isReleaseLink(_ url: URL?) -> Bool {
        guard let url, url.absoluteString.count <= 700,
              let c = URLComponents(url: url, resolvingAgainstBaseURL: false),
              c.scheme == "https", c.host == "github.com", c.port == nil,
              c.user == nil, c.password == nil, c.query == nil, c.fragment == nil,
              c.percentEncodedPath == c.path, !c.path.contains("..") else { return false }
        let base = "/zhoy0409-debug/polish-sci-figures/releases"
        return c.path == base || c.path == base + "/latest"
            || matches(c.path, "^" + base + "/tag/[A-Za-z0-9][A-Za-z0-9._-]{0,99}$")
            || matches(c.path, "^" + base + "/download/[A-Za-z0-9][A-Za-z0-9._-]{0,99}/polish-sci-figures-Studio-[0-9]+[.][0-9]+[.][0-9]+-(Setup-x64[.]exe|Portable-x64[.]zip|macOS-(arm64|x86_64)-Preview[.]zip|Android-preview[.]apk)$")
    }

    private static func matches(_ text: String, _ pattern: String) -> Bool {
        guard let range = text.range(of: pattern, options: .regularExpression) else { return false }
        return range == text.startIndex..<text.endIndex
    }

    static func result(data: Data, info: [String: Any], now: Date = Date()) throws -> [String: Any] {
        guard data.count <= maximumBytes,
              let values = try JSONSerialization.jsonObject(with: data) as? [[String: Any]], values.count <= 30 else {
            throw URLError(.cannotParseResponse)
        }
        let formatter = ISO8601DateFormatter()
        let releases: [(Date, String)] = values.compactMap { value in
            guard value["draft"] as? Bool == false,
                  let published = value["published_at"] as? String, let date = formatter.date(from: published),
                  let tag = value["tag_name"] as? String, matches(tag, "^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$"), !tag.contains(".."),
                  let html = value["html_url"] as? String, html == Self.releases + "/tag/" + tag,
                  isReleaseLink(URL(string: html)) else { return nil }
            return (date, html)
        }
        // iOS currently has simulator builds only. Other platform assets may
        // establish that a release exists, but never become an iOS installer.
        var result = info
        result["status"] = "unavailable"; result["reason"] = "no-installer"
        result["releaseUrl"] = releases.max(by: { $0.0 < $1.0 })?.1 ?? Self.releases
        result["checkedAt"] = formatter.string(from: now)
        result["cached"] = false; result["stale"] = false
        return result
    }

    static func selfChecks() -> [String: Bool] {
        let accepted = [releases, releases + "/tag/v1.4.6", releases + "/download/v1.4.6/polish-sci-figures-Studio-0.1.6-Setup-x64.exe"]
        let rejected = ["https://github.com.evil.invalid/zhoy0409-debug/polish-sci-figures/releases",
                        "https://evil@github.com/zhoy0409-debug/polish-sci-figures/releases",
                        releases + "?project=private", releases + "/tag/%76x", releases + "/tag/../escape",
                        releases + "/download/v1.4.6/other.exe", releases + "/download/v1.4.6/app.ipa"]
        let sample: [[String: Any]] = [["draft": false, "published_at": "2026-10-14T00:00:00Z", "tag_name": "v1.4.6", "html_url": releases + "/tag/v1.4.6", "assets": [["name": "polish-sci-figures-Studio-0.1.6-Android-preview.apk"]]]]
        let data = try? JSONSerialization.data(withJSONObject: sample)
        let result = data.flatMap { try? Self.result(data: $0, info: ["platform": "ios", "currentVersion": "0.1.6"]) }
        return ["officialUpdateLinksOnly": accepted.allSatisfy { isReleaseLink(URL(string: $0)) } && rejected.allSatisfy { !isReleaseLink(URL(string: $0)) },
                "noFabricatedIOSInstaller": result?["status"] as? String == "unavailable" && result?["downloadUrl"] == nil && result?["latestVersion"] == nil,
                "boundedOfficialUpdateEndpoint": endpoint.absoluteString == "https://api.github.com/repos/zhoy0409-debug/polish-sci-figures/releases?per_page=30"]
    }
}

/// The delegate accumulates at most 2 MiB on its serial queue, refuses all
/// redirects, and delivers one result. Cookies and credential stores are off.
private final class StudioReleaseRequest: NSObject, URLSessionDataDelegate {
    private var session: URLSession?
    private var bytes = Data()
    private var completion: (@MainActor (Result<Data, Error>) -> Void)?
    init(completion: @escaping @MainActor (Result<Data, Error>) -> Void) { self.completion = completion }
    func start() {
        let config = URLSessionConfiguration.ephemeral
        config.httpCookieStorage = nil; config.httpCookieAcceptPolicy = .never
        config.urlCredentialStorage = nil; config.urlCache = nil
        config.timeoutIntervalForRequest = 8; config.timeoutIntervalForResource = 9
        let queue = OperationQueue(); queue.maxConcurrentOperationCount = 1
        let session = URLSession(configuration: config, delegate: self, delegateQueue: queue); self.session = session
        var request = URLRequest(url: StudioUpdatePolicy.endpoint, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 8)
        request.httpMethod = "GET"; request.httpShouldHandleCookies = false
        request.setValue("application/vnd.github+json", forHTTPHeaderField: "Accept")
        request.setValue("FigureStudio-iOS-UpdateCheck", forHTTPHeaderField: "User-Agent")
        session.dataTask(with: request).resume()
    }
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) {
        completionHandler(nil)
    }
    func urlSession(_ session: URLSession, dataTask: URLSessionDataTask, didReceive response: URLResponse, completionHandler: @escaping (URLSession.ResponseDisposition) -> Void) {
        guard let http = response as? HTTPURLResponse, http.statusCode == 200,
              http.url == StudioUpdatePolicy.endpoint, response.expectedContentLength <= Int64(StudioUpdatePolicy.maximumBytes) else {
            completionHandler(.cancel); return
        }
        completionHandler(.allow)
    }
    func urlSession(_ session: URLSession, dataTask: URLSessionDataTask, didReceive data: Data) {
        guard data.count <= StudioUpdatePolicy.maximumBytes - bytes.count else { dataTask.cancel(); return }
        bytes.append(data)
    }
    func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
        guard let completion else { return }; self.completion = nil
        let result: Result<Data, Error> = error.map { .failure($0) } ?? .success(bytes)
        bytes = Data(); session.invalidateAndCancel(); self.session = nil
        DispatchQueue.main.async { completion(result) }
    }
}

@MainActor
final class StudioUpdateService {
    private let defaults: UserDefaults
    private let cacheKey = "studio.ios.official-release-cache.v1"
    private var pending: [([String: Any]) -> Void] = []
    private var request: StudioReleaseRequest?
    init(defaults: UserDefaults = .standard) { self.defaults = defaults }
    var info: [String: Any] {
        ["platform": "ios", "architecture": "arm64", "channel": "preview",
         "currentVersion": Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "unknown",
         "suiteVersion": Bundle.main.object(forInfoDictionaryKey: "StudioSuiteVersion") as? String ?? "unknown"]
    }
    private func cached(stale: Bool) -> [String: Any]? {
        guard let value = defaults.dictionary(forKey: cacheKey),
              let stamp = value["time"] as? Double, stamp <= Date().timeIntervalSince1970 + 60,
              let url = value["releaseUrl"] as? String, StudioUpdatePolicy.isReleaseLink(URL(string: url)),
              !url.contains("/releases/download/"),
              stale || Date().timeIntervalSince1970 - stamp < 86400 else { return nil }
        var result = info
        result["status"] = "unavailable"; result["reason"] = stale ? "offline" : "no-installer"
        result["releaseUrl"] = url; result["checkedAt"] = ISO8601DateFormatter().string(from: Date(timeIntervalSince1970: stamp))
        result["cached"] = true; result["stale"] = stale
        return result
    }
    func check(refresh: Bool, completion: @escaping ([String: Any]) -> Void) {
        if !refresh, let cached = cached(stale: false) { completion(cached); return }
        guard pending.count < 16 else { completion(offline()); return }
        pending.append(completion); guard request == nil else { return }
        let request = StudioReleaseRequest { [weak self] outcome in
            guard let self else { return }
            let result: [String: Any]
            switch outcome {
            case .success(let bytes):
                if let fresh = try? StudioUpdatePolicy.result(data: bytes, info: self.info) {
                    result = fresh
                    self.defaults.set(["time": Date().timeIntervalSince1970, "releaseUrl": fresh["releaseUrl"] as? String ?? StudioUpdatePolicy.releases], forKey: self.cacheKey)
                } else { result = self.cached(stale: true) ?? self.offline() }
            case .failure: result = self.cached(stale: true) ?? self.offline()
            }
            let waiting = self.pending; self.pending = []; self.request = nil
            waiting.forEach { $0(result) }
        }
        self.request = request; request.start()
    }
    private func offline() -> [String: Any] {
        var result = info; result["status"] = "offline"; result["reason"] = "offline"
        result["releaseUrl"] = StudioUpdatePolicy.releases; result["cached"] = false; result["stale"] = false
        return result
    }
}
