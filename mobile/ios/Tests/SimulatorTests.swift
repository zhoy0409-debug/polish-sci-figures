import XCTest

final class SimulatorTests: XCTestCase {
    @MainActor
    private func waitForPaintedMobileControls(_ app: XCUIApplication) {
        let canvas = app.buttons.matching(NSPredicate(format: "label == 'Canvas' OR label == '画布'")).firstMatch
        let pan = app.buttons.matching(NSPredicate(format: "label == 'Pan' OR label == '移动画布'")).firstMatch
        let ready = NSPredicate { _, _ in canvas.isHittable && pan.isHittable }
        XCTAssertEqual(XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: ready, object: nil)], timeout: 15), .completed, "The mobile canvas controls have not become visible and usable")
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
        let save = app.navigationBars.buttons["Save"].firstMatch
        XCTAssertTrue(save.waitForExistence(timeout: 30), "Local Files save destination is unavailable")
        XCTAssertTrue(save.isEnabled, "The Files provider did not offer a writable local folder")
        let destination = XCTAttachment(screenshot: app.screenshot()); destination.name = "iOS local Files save destination"; destination.lifetime = .keepAlways; add(destination)
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
            let exports = app.cells.containing(.staticText, identifier: "Exports").firstMatch
            if exports.waitForExistence(timeout: 5) { exports.tap() }
            document = app.cells.matching(filename).firstMatch
        }
        XCTAssertTrue(document.waitForExistence(timeout: 15), "Saved local project is not visible in the actual Files picker")
        let imported = XCTAttachment(screenshot: app.screenshot()); imported.name = "iOS Files reimport selection"; imported.lifetime = .keepAlways; add(imported)
        document.tap()
        let confirm = app.alerts.buttons["Confirm"].firstMatch
        XCTAssertTrue(confirm.waitForExistence(timeout: 15), "Project replacement confirmation did not appear")
        confirm.tap()
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
