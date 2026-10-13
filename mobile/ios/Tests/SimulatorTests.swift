import XCTest

final class SimulatorTests: XCTestCase {
    @MainActor
    func testLocalEngineExportCancelAndRestart() throws {
        continueAfterFailure = false
        let app = XCUIApplication()
        app.launchArguments = ["--smoke"]
        app.launch()
        let cancel = app.buttons["Cancel"].firstMatch
        let failure = app.staticTexts["SIMULATOR SMOKE FAILED"]
        let ready = NSPredicate { _, _ in cancel.exists || failure.exists }
        let readyResult = XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: ready, object: nil)], timeout: 300)
        let first = XCTAttachment(screenshot: app.screenshot()); first.name = "iOS native export picker"; first.lifetime = .keepAlways; add(first)
        XCTAssertEqual(readyResult, .completed, "No export picker or smoke report within 300 seconds")
        XCTAssertFalse(failure.exists, "Engine smoke failed; inspect simulator-smoke.json")
        XCTAssertTrue(cancel.exists, "Native Files export dialog absent")
        cancel.tap()
        XCTAssertTrue(app.staticTexts["SIMULATOR SMOKE PASSED"].waitForExistence(timeout: 30), "Export cancellation did not complete")
        let final = XCTAttachment(screenshot: app.screenshot()); final.name = "iOS local engine complete"; final.lifetime = .keepAlways; add(final)
        app.terminate()
        app.launchArguments = ["--smoke", "--restore"]
        app.launch()
        XCTAssertTrue(app.staticTexts["SIMULATOR SMOKE PASSED"].waitForExistence(timeout: 45), "Editor autosave not restored after process restart")
        let restored = XCTAttachment(screenshot: app.screenshot()); restored.name = "iOS restored local project"; restored.lifetime = .keepAlways; add(restored)
    }
}
