import SwiftUI

/// 活動明細:100 席四色,唯讀不可點(iOS 不做選位,FR-071)。
public struct EventDetailView: View {
    @EnvironmentObject var app: AppModel
    let id: String
    @State private var detail: Components.Schemas.EventDetail?
    @State private var error: String?
    private let columns = Array(repeating: GridItem(.flexible(), spacing: 2), count: 10)

    public var body: some View {
        ScrollView {
            if let d = detail {
                let ev = d.value1.value1
                VStack(alignment: .leading, spacing: 8) {
                    Text(ev.name).font(.title2)
                    ForEach(d.value2.ticket_types, id: \.id) { t in
                        Text("\(t.name)・\(Money.format(t.price_cents))・剩 \(t.remaining)").font(.caption)
                    }
                    LazyVGrid(columns: columns, spacing: 2) {
                        ForEach(d.value2.seats, id: \.seat_no) { s in
                            Text(s.seat_no).font(.system(size: 9)).frame(maxWidth: .infinity, minHeight: 24)
                                .background(color(s.state)).clipShape(RoundedRectangle(cornerRadius: 3))
                        }
                    }
                }.padding()
            } else if let error { Text(error).foregroundStyle(.red) }
        }
        .navigationTitle("座位")
        .task { await load() }
    }

    func color(_ s: Components.Schemas.Seat.statePayload) -> Color {
        switch s { case .free: .gray.opacity(0.2); case .held: .yellow; case .sold: .gray; case .mine: .green }
    }

    func load() async {
        do {
            switch try await app.client.getEvent(path: .init(id: id)) {
            case .ok(let ok): detail = try ok.body.json
            case .notFound: error = "not_found"
            case .unauthorized: app.loggedIn = false
            case .undocumented(let code, _): error = "http_\(code)"
            }
        } catch { self.error = "\(error)" }
    }
}
