import Foundation

/// 票券畫面用的金額顯示。後端金額為整數「分」(`total_cents`)。
public enum Money {
    /// 把「分」轉成 `NT$4,444.20` 格式。
    ///
    /// 全程用整數運算,不經過 Double / NumberFormatter,
    /// 因此不會有浮點誤差,也不受裝置語系影響(千分位一律 `,`、小數點一律 `.`)。
    /// 負數顯示為 `-NT$12.34`。
    public static func format(_ cents: Int) -> String {
        // 用 magnitude(UInt)取絕對值,避免 Int.min 取負時溢位
        let magnitude = cents.magnitude
        let dollars = magnitude / 100
        let fraction = magnitude % 100

        let sign = cents < 0 ? "-" : ""
        let fractionText = fraction < 10 ? "0\(fraction)" : "\(fraction)"
        return "\(sign)NT$\(groupThousands(dollars)).\(fractionText)"
    }

    private static func groupThousands(_ value: UInt) -> String {
        let digits = String(value)
        var result = ""
        result.reserveCapacity(digits.count + digits.count / 3)
        for (index, digit) in digits.enumerated() {
            if index > 0 && (digits.count - index) % 3 == 0 {
                result.append(",")
            }
            result.append(digit)
        }
        return result
    }
}
