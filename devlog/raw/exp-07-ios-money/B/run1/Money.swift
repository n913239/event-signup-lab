import Foundation

/// 票券畫面用的金額顯示。後端金額為整數「分」(`total_cents`)。
public enum Money {
    /// 把「分」轉成 `NT$4,444.20` 格式的字串。
    ///
    /// - 全程整數運算,不經過 `Double`,不會有浮點誤差。
    /// - 不依賴使用者的 Locale:千分位固定 `,`、小數點固定 `.`、固定兩位小數。
    /// - 負數(退款)顯示為 `-NT$4,444.20`;`Int.min` 也能正確處理。
    public static func format(_ cents: Int) -> String {
        let magnitude = cents.magnitude  // UInt,避免 Int.min 取負溢位
        let dollars = magnitude / 100
        let fraction = magnitude % 100

        let fractionText = fraction < 10 ? "0\(fraction)" : "\(fraction)"
        let sign = cents < 0 ? "-" : ""
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
