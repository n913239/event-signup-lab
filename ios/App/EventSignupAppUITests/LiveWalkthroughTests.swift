import XCTest

/// 模擬器接線上 Worker 走一遍三畫面(登入 → 活動 → 票券),每一步截圖留證(T055)。
/// 帳密從環境變數來(TEST_RUNNER_DEMO_EMAIL / TEST_RUNNER_DEMO_PASSWORD),沒給就跳過,不進版控。
final class LiveWalkthroughTests: XCTestCase {
    func testLoginEventsTickets() throws {
        let env = ProcessInfo.processInfo.environment
        guard let email = env["DEMO_EMAIL"], let password = env["DEMO_PASSWORD"] else {
            throw XCTSkip("沒給 DEMO_EMAIL / DEMO_PASSWORD")
        }
        let app = XCUIApplication()
        app.launch()
        // 上一次跑留下的 refresh token 還在 Keychain 時,App 一開就是已登入:先從票券頁登出(順便走一次線上登出,T084)
        if app.tabBars.firstMatch.waitForExistence(timeout: 5) {
            app.tabBars.buttons["票券"].tap()
            app.navigationBars.buttons["登出"].tap()
        }
        snap(app, "1-login")

        let emailField = app.textFields["email"]
        XCTAssertTrue(emailField.waitForExistence(timeout: 10))
        emailField.tap(); emailField.typeText(email)
        let pw = app.secureTextFields["密碼"]
        pw.tap(); pw.typeText(password)
        app.buttons["登入"].tap()

        XCTAssertTrue(app.navigationBars["活動"].waitForExistence(timeout: 20), "登入後沒進活動列表")
        sleep(3)                                                           // 等 GET /events 回來
        snap(app, "2-events")

        app.tabBars.buttons["票券"].tap()
        XCTAssertTrue(app.navigationBars["我的票券"].waitForExistence(timeout: 20))
        sleep(3)
        snap(app, "3-tickets")
        XCTAssertFalse(app.staticTexts["離線資料"].exists, "票券畫面顯示離線資料 —— 沒連上線上 API")
    }

    private func snap(_ app: XCUIApplication, _ name: String) {
        let a = XCTAttachment(screenshot: app.screenshot())
        a.name = name; a.lifetime = .keepAlways
        add(a)
    }
}
