import SwiftUI

/// 三畫面:登入、活動列表(唯讀)、我的票券。
public struct RootView: View {
    @StateObject private var app: AppModel
    public init(baseURL: URL = URL(string: "http://127.0.0.1:8788")!) {
        _app = StateObject(wrappedValue: AppModel(baseURL: baseURL))
    }

    public var body: some View {
        Group {
            if app.loggedIn {
                TabView {
                    NavigationStack { EventListView() }.tabItem { Label("活動", systemImage: "calendar") }
                    NavigationStack { TicketListView() }.tabItem { Label("票券", systemImage: "qrcode") }
                }
            } else {
                NavigationStack { LoginView() }
            }
        }
        .environmentObject(app)
    }
}
