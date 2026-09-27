import EventSignup
import SwiftUI

@main
struct EventSignupApp: App {
    // API 位址從 Info.plist 的 API_BASE_URL 來(project.yml 設定,預設線上 Worker)
    let baseURL = (Bundle.main.object(forInfoDictionaryKey: "API_BASE_URL") as? String).flatMap(URL.init(string:))
        ?? URL(string: "http://127.0.0.1:8788")!
    var body: some Scene { WindowGroup { RootView(baseURL: baseURL) } }
}
