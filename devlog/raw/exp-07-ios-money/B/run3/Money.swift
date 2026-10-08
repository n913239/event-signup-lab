import Foundation

/// 票券畫面用的金額顯示。後端 `total_cents` 是整數「分」。
public enum Money {
    /// 444420 → "NT$4,444.20";-1250 → "-NT$12.50"。
    ///
    /// 全程整數運算,不經過 Double,也不吃裝置 locale,
    /// 所以不會有浮點誤差,也不會因使用者地區設定而變成 "4.444,20"。
    public static func format(_ cents: Int) -> String {
        // magnitude 是 UInt,Int.min 也不會溢位
        let abs = cents.magnitude
        let dollars = abs / 100
        let fraction = abs % 100

        let fractionText = fraction < 10 ? "0\(fraction)" : "\(fraction)"
        let sign = cents < 0 ? "-" : ""
        return "\(sign)NT$\(groupThousands(dollars)).\(fractionText)"
    }

    private static func groupThousands(_ value: UInt) -> String {
        let digits = String(value)
        var result = ""
        for (index, digit) in digits.enumerated() {
            if index > 0 && (digits.count - index) % 3 == 0 {
                result.append(",")
            }
            result.append(digit)
        }
        return result
    }
}
