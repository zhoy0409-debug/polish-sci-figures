import XCTest

final class SimulatorTests: XCTestCase {
    @MainActor
    private func tapReadyControl(_ control: XCUIElement, in app: XCUIApplication, message: String) -> Bool {
        let ready = NSPredicate { _, _ in control.exists && control.isHittable && control.isEnabled }
        guard XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: ready, object: nil)], timeout: 30) == .completed else {
            XCTFail(message); return false
        }
        let frame = control.frame
        guard !frame.isEmpty && frame.midX.isFinite && frame.midY.isFinite else {
            XCTFail("Native control has no usable on-screen frame: " + message); return false
        }
        // Use the control observed in the current native UI. A second global
        // interruption scan can race the Files provider's accessibility tree.
        app.coordinate(withNormalizedOffset: .zero).withOffset(CGVector(dx: frame.midX, dy: frame.midY)).tap()
        return true
    }

    @MainActor
    private func selectOnDeviceRoot(_ app: XCUIApplication) -> Bool {
        let local = app.cells.containing(NSPredicate(format: "label CONTAINS 'On My iPhone' OR label CONTAINS 'On My iPad'")).firstMatch
        let back = app.navigationBars.buttons.matching(NSPredicate(format: "label == 'On My iPhone' OR label == 'On My iPad' OR label == 'Browse'")).firstMatch
        let browse = app.buttons["Browse"].firstMatch
        // The native provider can paint its sheet before attaching navigation
        // controls to accessibility. Observe readiness rather than interpreting
        // that initial transition as a missing Browse button, or sleeping.
        let ready = NSPredicate { _, _ in local.exists || back.exists || browse.exists }
        let readiness = XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: ready, object: nil)], timeout: 45)
        guard readiness == .completed else {
            XCTFail("Native Files navigation did not become available within 45 seconds"); return false
        }
        var selected = false
        for _ in 0..<6 {
            if local.waitForExistence(timeout: 2) {
                guard tapReadyControl(local, in: app, message: "On-device Files location is not actionable") else { return false }
                selected = true; break
            }
            // On iPhone, return from a folder through its real parent buttons
            // to Browse. On iPad, the location cell is normally in the sidebar.
            if back.waitForExistence(timeout: 3) {
                guard tapReadyControl(back, in: app, message: "Files parent navigation is not actionable") else { return false }
            }
            else {
                guard tapReadyControl(browse, in: app, message: "No native Browse button or on-device Files location is available") else { return false }
            }
        }
        guard selected else { XCTFail("The test did not explicitly select an on-device Files location"); return false }
        let title = app.navigationBars.descendants(matching: .any).matching(NSPredicate(format: "label == 'On My iPhone' OR label == 'On My iPad' OR label BEGINSWITH 'On My iPhone,' OR label BEGINSWITH 'On My iPad,'")).firstMatch
        guard title.waitForExistence(timeout: 15) else { XCTFail("Files did not display the selected on-device root"); return false }
        return true
    }

    @MainActor
    private func waitForPaintedMobileControls(_ app: XCUIApplication) {
        // WebKit exposes the canvas control as an ARIA tab. Do not assume it
        // has XCTest's Button element type across iOS accessibility versions.
        let canvas = app.descendants(matching: .any).matching(NSPredicate(format: "label == 'Canvas' OR label == '画布'"))
        let pan = app.descendants(matching: .any).matching(NSPredicate(format: "label == 'Pan' OR label == '移动画布'"))
        // The labelled tab panel and the tab itself can both be named Canvas.
        let ready = NSPredicate { _, _ in canvas.allElementsBoundByIndex.contains { $0.isHittable } && pan.allElementsBoundByIndex.contains { $0.isHittable } }
        let result = XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: ready, object: nil)], timeout: 15)
        guard result == .completed else { XCTFail("The mobile canvas controls have not become visible and usable"); return }
        let frame = XCTAttachment(screenshot: XCUIScreen.main.screenshot()); frame.name = "iOS mobile frame readiness"; frame.lifetime = .keepAlways; add(frame)
    }

    @MainActor
    func testLocalEngineExportCancelAndRestart() throws {
        continueAfterFailure = false
        let app = XCUIApplication()
        app.launchArguments = ["--smoke"]
        app.launch()
        let cancel = app.buttons["Cancel"].firstMatch
        let pickerSave = app.navigationBars.buttons["Save"].firstMatch
        let failure = app.staticTexts["SIMULATOR SMOKE FAILED"]
        let ready = NSPredicate { _, _ in cancel.exists || pickerSave.exists || failure.exists }
        let readyResult = XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: ready, object: nil)], timeout: 300)
        guard readyResult == .completed else { XCTFail("No export picker or smoke report within 300 seconds"); return }
        guard !failure.exists else { XCTFail("Engine smoke failed; inspect simulator-smoke.json"); return }
        // Inside a folder, Files uses the left button for Back. The root
        // location screen exposes Cancel. Wait for an actionable control:
        // the Files accessibility tree can detach briefly while it paints.
        // Do not take a diagnostic screenshot before this real interaction.
        for _ in 0..<6 {
            let back = app.navigationBars.buttons.element(boundBy: 0)
            let navigationReady = NSPredicate { _, _ in
                (cancel.exists && cancel.isHittable) ||
                (back.exists && back.isHittable && back.label != "Save" && back.label != "Cancel")
            }
            guard XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: navigationReady, object: nil)], timeout: 30) == .completed else {
                XCTFail("Native Files Cancel or its parent navigation did not become actionable"); return
            }
            if cancel.exists && cancel.isHittable { break }
            XCTAssertTrue(back.exists && back.isHittable && back.label != "Save" && back.label != "Cancel", "No native Files back button to reach Cancel")
            guard tapReadyControl(back, in: app, message: "Native Files back button is not actionable") else { return }
        }
        guard tapReadyControl(cancel, in: app, message: "Native Files Cancel is unavailable after returning to locations") else { return }
        // The next operation uses the real project Save handler. Do not bypass
        // the Files provider or substitute a private spool write for saving.
        let projectName = app.textFields.matching(NSPredicate(format: "value CONTAINS %@", "figure-studio-project")).firstMatch
        XCTAssertTrue(projectName.waitForExistence(timeout: 30), "The new project export picker did not finish opening")
        let save = app.navigationBars.buttons["Save"].firstMatch
        // An enabled Save button alone says nothing about whether the selected
        // provider is on-device. Explicitly select the local root every time.
        guard selectOnDeviceRoot(app) else { return }
        let writable = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in save.exists && save.isEnabled && save.isHittable }, object: nil)
        guard XCTWaiter.wait(for: [writable], timeout: 30) == .completed else { XCTFail("The Files provider did not offer a writable local folder"); return }
        // Navigation has completed and the local destination is writable.
        let destination = XCTAttachment(screenshot: XCUIScreen.main.screenshot()); destination.name = "iOS local Files save destination"; destination.lifetime = .keepAlways; add(destination)
        guard tapReadyControl(save, in: app, message: "Local Files Save is not actionable") else { return }
        let openProject = app.buttons["Open saved project"].firstMatch
        guard tapReadyControl(openProject, in: app, message: "Actual Files save did not complete") else { return }
        guard selectOnDeviceRoot(app) else { return }
        let filename = NSPredicate(format: "label CONTAINS %@", "figure-studio-project")
        let document = app.cells.matching(filename).firstMatch
        XCTAssertTrue(document.waitForExistence(timeout: 15), "Saved local project is not visible in the actual Files picker")
        let imported = XCTAttachment(screenshot: XCUIScreen.main.screenshot()); imported.name = "iOS Files reimport selection"; imported.lifetime = .keepAlways; add(imported)
        guard tapReadyControl(document, in: app, message: "Saved local project is not actionable in the actual Files picker") else { return }
        let confirm = app.alerts.buttons["Confirm"].firstMatch
        // Handle the actual confirmation before diagnostic capture. WebKit's
        // synchronous window.confirm can suspend screenshots and AX rescans.
        guard confirm.waitForExistence(timeout: 30) else {
            XCTFail("Project replacement confirmation did not appear"); return
        }
        // A synchronous window.confirm suspends the WK JavaScript context.
        // XCTest's global interruption rescan can wait on that suspended page;
        // tap the observed native alert button's actual on-screen centre.
        let confirmFrame = confirm.frame
        XCTAssertGreaterThan(confirmFrame.width, 0); XCTAssertGreaterThan(confirmFrame.height, 0)
        app.coordinate(withNormalizedOffset: .zero).withOffset(CGVector(dx: confirmFrame.midX, dy: confirmFrame.midY)).tap()
        XCTAssertTrue(app.staticTexts["SIMULATOR SMOKE PASSED"].waitForExistence(timeout: 30), "Native save, reimport or editor restoration did not complete")
        waitForPaintedMobileControls(app)
        let final = XCTAttachment(screenshot: XCUIScreen.main.screenshot()); final.name = "iOS local engine complete"; final.lifetime = .keepAlways; add(final)
        app.terminate()
        app.launchArguments = ["--smoke", "--restore"]
        app.launch()
        XCTAssertTrue(app.staticTexts["SIMULATOR SMOKE PASSED"].waitForExistence(timeout: 45), "Editor autosave not restored after process restart")
        waitForPaintedMobileControls(app)
        let restored = XCTAttachment(screenshot: XCUIScreen.main.screenshot()); restored.name = "iOS restored local project"; restored.lifetime = .keepAlways; add(restored)
    }
}
