import SwiftUI

/// 活動列表(唯讀):GET /events?status=on_sale。
public struct EventListView: View {
    @EnvironmentObject var app: AppModel
    @State private var events: [Components.Schemas.EventSummary] = []
    @State private var error: String?
    public init() {}

    public var body: some View {
        List(events, id: \.id) { e in
            NavigationLink(value: e.id) {
                VStack(alignment: .leading) {
                    Text(e.name).font(.headline)
                    Text("開賣 \(epochDate(e.opens_at))・截止 \(epochDate(e.deadline_at))").font(.caption)
                    Text("剩 \(e.remaining_seats) 席").font(.caption)
                }
            }
        }
        .navigationDestination(for: String.self) { EventDetailView(id: $0) }
        .overlay { if let error { Text(error).foregroundStyle(.red) } }
        .navigationTitle("活動")
        .task { await load() }
        .refreshable { await load() }
    }

    func load() async {
        do {
            switch try await app.client.listEvents(query: .init(status: .on_sale)) {
            case .ok(let ok): events = try ok.body.json.events; error = nil
            case .unauthorized: app.loggedIn = false
            case .undocumented(let code, _): error = "http_\(code)"
            }
        } catch { self.error = "\(error)" }
    }
}
