import SwiftUI

/// 我的票券:GET /orders;成功就更新快取,失敗就讀快取並標「離線資料」。
public struct TicketListView: View {
    @EnvironmentObject var app: AppModel
    @State private var orders: [Components.Schemas.Order] = []
    @State private var offline = false
    @State private var logoutFailed = false
    public init() {}

    public var body: some View {
        List {
            if offline { Text("離線資料").font(.caption).foregroundStyle(.orange) }
            ForEach(orders, id: \.id) { o in
                NavigationLink { TicketDetailView(order: o) } label: {
                    VStack(alignment: .leading) {
                        Text(o.event_name).font(.headline)
                        Text("\(o.items.map(\.seat_no).joined(separator: "、"))・\(Money.format(o.total_cents))・\(o.status.rawValue)")
                            .font(.caption)
                    }
                }
            }
        }
        .navigationTitle("我的票券")
        .toolbar { Button("登出") { Task { logoutFailed = !(await app.logout()) } } }
        .alert("登出需要連線", isPresented: $logoutFailed) { Button("好") {} } message: { Text("連上網路後再登出一次,伺服器才會撤銷這台裝置的登入。") }
        .task { await load() }
        .refreshable { await load() }
    }

    func load() async {
        do {
            switch try await app.client.listOrders() {
            case .ok(let ok):
                orders = try ok.body.json.orders; offline = false; OrdersCache.save(orders)
            case .unauthorized: app.loggedIn = false
            case .undocumented: fallback()
            }
        } catch { fallback() }
    }

    func fallback() {
        if let cached = OrdersCache.load() { orders = cached; offline = true }
    }
}
