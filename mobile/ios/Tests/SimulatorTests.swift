import XCTest

final class SimulatorTests: XCTestCase {
    @MainActor
    private func waitForPaintedMobileControls(_ app: XCUIApplication) {
        // WebKit exposes the canvas control as an ARIA tab. Do not assume it
        // has XCTest's Button element type across iOS accessibility versions.
        let canvas = app.descendants(matching: .any).matching(NSPredicate(format: "label == 'Canvas' OR label == '画布'"))
        let pan = app.descendants(matching: .any).matching(NSPredicate(format: "label == 'Pan' OR label == '移动画布'"))
        // The labelled tab panel and the tab itself can both be named Canvas.
        let ready = NSPredicate { _, _ in canvas.allElementsBoundByIndex.contains { $0.isHittable } && pan.allElementsBoundByIndex.contains { $0.isHittable } }
        let result = XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: ready, object: nil)], timeout: 15)
        let frame = XCTAttachment(screenshot: app.screenshot()); frame.name = "iOS mobile frame readiness"; frame.lifetime = .keepAlways; add(frame)
        if result != .completed { print("MOBILE ACCESSIBILITY HIERARCHY\n" + app.debugDescription) }
        XCTAssertEqual(result, .completed, "The mobile canvas controls have not become visible and usable")
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
        let first = XCTAttachment(screenshot: app.screenshot()); first.name = "iOS native export picker"; first.lifetime = .keepAlways; add(first)
        XCTAssertEqual(readyResult, .completed, "No export picker or smoke report within 300 seconds")
        XCTAssertFalse(failure.exists, "Engine smoke failed; inspect simulator-smoke.json")
        // Inside a folder, Files uses the left button for Back. The root
        // location screen exposes Cancel; do not assume the initial location.
        for _ in 0..<6 {
            if cancel.exists { break }
            let back = app.navigationBars.buttons.element(boundBy: 0)
            XCTAssertTrue(back.exists && back.label != "Save", "No native Files back button to reach Cancel")
            back.tap()
        }
        XCTAssertTrue(cancel.waitForExistence(timeout: 5), "Native Files Cancel is unavailable after returning to locations")
        cancel.tap()
        // The next operation uses the real project Save handler. Do not bypass
        // the Files provider or substitute a private spool write for saving.
        let projectName = app.textFields.matching(NSPredicate(format: "value CONTAINS %@", "figure-studio-project")).firstMatch
        XCTAssertTrue(projectName.waitForExistence(timeout: 30), "The new project export picker did not finish opening")
        let save = app.navigationBars.buttons["Save"].firstMatch
        XCTAssertTrue(save.waitForExistence(timeout: 5), "Local Files save destination is unavailable")
        if !save.isEnabled {
            // directoryURL only suggests an initial view. A fresh simulator's
            // local provider may require selecting the visible location once.
            // Exercise that real UI path instead of writing to the spool.
            let local = app.cells.containing(NSPredicate(format: "label CONTAINS 'On My iPhone' OR label CONTAINS 'On My iPad'")).firstMatch
            XCTAssertTrue(local.waitForExistence(timeout: 5), "The on-device Files location is unavailable")
            local.tap()
            let folder = app.cells.containing(.staticText, identifier: "Figure Studio Preview").firstMatch
            XCTAssertTrue(folder.waitForExistence(timeout: 5), "The app's local Documents folder is unavailable")
            folder.tap()
        }
        let destination = XCTAttachment(screenshot: app.screenshot()); destination.name = "iOS local Files save destination"; destination.lifetime = .keepAlways; add(destination)
        let writable = XCTNSPredicateExpectation(predicate: NSPredicate(format: "exists == true AND enabled == true"), object: save)
        XCTAssertEqual(XCTWaiter.wait(for: [writable], timeout: 10), .completed, "The Files provider did not offer a writable local folder")
        save.tap()
        let openProject = app.buttons["Open saved project"].firstMatch
        XCTAssertTrue(openProject.waitForExistence(timeout: 30), "Actual Files save did not complete")
        openProject.tap()
        let filename = NSPredicate(format: "label CONTAINS %@", "figure-studio-project")
        var document = app.cells.matching(filename).firstMatch
        if !document.waitForExistence(timeout: 8) {
            let browse = app.buttons["Browse"].firstMatch
            if browse.exists { browse.tap() }
            let local = app.cells.containing(NSPredicate(format: "label CONTAINS 'On My iPhone' OR label CONTAINS 'On My iPad'")).firstMatch
            if local.waitForExistence(timeout: 5) { local.tap() }
            let folder = app.cells.containing(.staticText, identifier: "Figure Studio Preview").firstMatch
            if folder.waitForExistence(timeout: 5) { folder.tap() }
            document = app.cells.matching(filename).firstMatch
        }
        XCTAssertTrue(document.waitForExistence(timeout: 15), "Saved local project is not visible in the actual Files picker")
        let imported = XCTAttachment(screenshot: app.screenshot()); imported.name = "iOS Files reimport selection"; imported.lifetime = .keepAlways; add(imported)
        document.tap()
        let confirm = app.alerts.buttons["Confirm"].firstMatch
        let confirmationShown = confirm.waitForExistence(timeout: 15)
        let selected = XCTAttachment(screenshot: app.screenshot()); selected.name = "iOS after choosing saved project"; selected.lifetime = .keepAlways; add(selected)
        if !confirmationShown { print("FILES SELECTION HIERARCHY\n" + app.debugDescription) }
        XCTAssertTrue(confirmationShown, "Project replacement confirmation did not appear")
        // A synchronous window.confirm suspends the WK JavaScript context.
        // XCTest's global interruption rescan can wait on that suspended page;
        // tap the observed native alert button's actual on-screen centre.
        let confirmFrame = confirm.frame
        XCTAssertGreaterThan(confirmFrame.width, 0); XCTAssertGreaterThan(confirmFrame.height, 0)
        app.coordinate(withNormalizedOffset: .zero).withOffset(CGVector(dx: confirmFrame.midX, dy: confirmFrame.midY)).tap()
        XCTAssertTrue(app.staticTexts["SIMULATOR SMOKE PASSED"].waitForExistence(timeout: 30), "Native save, reimport or editor restoration did not complete")
        waitForPaintedMobileControls(app)
        let final = XCTAttachment(screenshot: app.screenshot()); final.name = "iOS local engine complete"; final.lifetime = .keepAlways; add(final)
        app.terminate()
        app.launchArguments = ["--smoke", "--restore"]
        app.launch()
        XCTAssertTrue(app.staticTexts["SIMULATOR SMOKE PASSED"].waitForExistence(timeout: 45), "Editor autosave not restored after process restart")
        waitForPaintedMobileControls(app)
        let restored = XCTAttachment(screenshot: app.screenshot()); restored.name = "iOS restored local project"; restored.lifetime = .keepAlways; add(restored)
    }
}
