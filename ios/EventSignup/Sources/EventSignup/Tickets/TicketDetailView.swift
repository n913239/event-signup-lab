import CoreImage
import CoreImage.CIFilterBuiltins
import SwiftUI

/// 票券明細:金額快照 + qr_payload 畫成 QR(CoreImage,不依賴 UIKit)。
public struct TicketDetailView: View {
    let order: Components.Schemas.Order

    public var body: some View {
        List {
            ForEach(order.items, id: \.seat_no) { i in
                Text("\(i.seat_no) \(i.ticket_type_name) \(Money.format(i.unit_price_cents))")
            }
            Text("小計 \(Money.format(order.subtotal_cents))・早鳥 \(order.early_bird_pct)%・團體 \(order.group_pct)%")
            if let code = order.promo_code { Text("\(code) −\(Money.format(order.promo_cents))") }
            Text("總計 \(Money.format(order.total_cents))").bold()
            if let img = qr(order.qr_payload) {
                Image(decorative: img, scale: 1).interpolation(.none).resizable().scaledToFit().frame(width: 200, height: 200)
            }
        }
        .navigationTitle(order.event_name)
    }

    func qr(_ text: String) -> CGImage? {
        guard !text.isEmpty else { return nil }
        let f = CIFilter.qrCodeGenerator()
        f.message = Data(text.utf8)
        guard let out = f.outputImage?.transformed(by: .init(scaleX: 8, y: 8)) else { return nil }
        return CIContext().createCGImage(out, from: out.extent)
    }
}
