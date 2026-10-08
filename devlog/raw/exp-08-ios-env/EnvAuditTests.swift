final class EnvAuditTests: XCTestCase {
    func testAuditFiveScreens() throws {
        let env = ProcessInfo.processInfo.environment
        guard let email = env["DEMO_EMAIL"], let password = env["DEMO_PASSWORD"] else { throw XCTSkip("no creds") }
        let mode = env["AUDIT_MODE"] ?? "default"
        let dir = env["SHOT_DIR"] ?? "/tmp/exp08-shots"
        try? FileManager.default.createDirectory(atPath: dir, withIntermediateDirectories: true)
        let app = XCUIApplication()
        if mode == "xxxl" { app.launchArguments += ["-UIPreferredContentSizeCategoryName", "UICTContentSizeCategoryAccessibilityXXXL"] }
        XCUIDevice.shared.appearance = (mode == "dark") ? .dark : .light
        app.launch()
        if app.tabBars.firstMatch.waitForExistence(timeout: 5) {
            app.tabBars.buttons["票券"].tap()
            app.navigationBars.buttons["登出"].tap()
        }
        XCTAssertTrue(app.textFields["email"].waitForExistence(timeout: 10))
        audit(app, mode, "1-login", dir)
        let f = app.textFields["email"]; f.tap(); f.typeText(email)
        let pw = app.secureTextFields["密碼"]; pw.tap(); pw.typeText(password)
        app.buttons["登入"].tap()
        XCTAssertTrue(app.navigationBars["活動"].waitForExistence(timeout: 20))
        sleep(3); audit(app, mode, "2-events", dir)
        app.staticTexts["示範活動:秋季音樂會"].tap()
        XCTAssertTrue(app.navigationBars["座位"].waitForExistence(timeout: 10))
        sleep(3); audit(app, mode, "3-seats", dir)
        for seat in ["A1", "C3"] { print("SEATLABEL|\(mode)|\(seat)|\(app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH %@", seat)).firstMatch.label)") }
        app.tabBars.buttons["票券"].tap()
        XCTAssertTrue(app.navigationBars["我的票券"].waitForExistence(timeout: 20))
        sleep(3); audit(app, mode, "4-tickets", dir)
        app.cells.firstMatch.tap()
        sleep(2); audit(app, mode, "5-ticket-detail", dir)
    }

    private func audit(_ app: XCUIApplication, _ mode: String, _ screen: String, _ dir: String) {
        try? app.screenshot().pngRepresentation.write(to: URL(fileURLWithPath: "\(dir)/\(mode)-\(screen).png"))
        var n = 0
        do {
            try app.performAccessibilityAudit { issue in
                n += 1
                let el = issue.element.map { "\($0.elementType.rawValue):\($0.label)" } ?? "-"
                print("AUDIT|\(mode)|\(screen)|\(issue.auditType.rawValue)|\(issue.compactDescription)|\(el)")
                return true
            }
        } catch { print("AUDIT|\(mode)|\(screen)|ERROR|\(error)") }
        print("AUDITCOUNT|\(mode)|\(screen)|\(n)")
    }
}
