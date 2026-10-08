/// 票券畫面用的金額顯示。後端金額一律是整數「分」(`*_cents`)。
/// 全程只用整數運算,不經過任何浮點數。
public enum Money {
    /// 例:`5 → NT$0.05`、`444420 → NT$4,444.20`、`100000 → NT$1,000`、`-12345 → -NT$123.45`
    public static func format(_ cents: Int) -> String {
        // 用 magnitude(UInt)取絕對值,避免 Int.min 取負時溢位
        let magnitude = cents.magnitude
        let dollars = magnitude / 100
        let remainder = magnitude % 100

        var result = cents < 0 ? "-NT$" : "NT$"
        result += groupThousands(dollars)
        if remainder != 0 {
            result += remainder < 10 ? ".0\(remainder)" : ".\(remainder)"
        }
        return result
    }

    private static func groupThousands(_ value: UInt) -> String {
        let digits = Array(String(value))
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
