/// 票券畫面用的金額顯示。後端金額一律是整數「分」(`*_cents`),
/// 這裡全程只用整數運算,不經過任何浮點數。
public enum Money {
    /// 把「分」格式化成 `NT$` 金額字串。
    ///
    ///     Money.format(5)       // "NT$0.05"
    ///     Money.format(444420)  // "NT$4,444.20"
    ///     Money.format(100000)  // "NT$1,000"
    ///     Money.format(-12345)  // "-NT$123.45"
    public static func format(_ cents: Int) -> String {
        // 用 magnitude(UInt)取絕對值,Int.min 也不會溢位。
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

    /// 自己插千分位逗號,不依賴 NumberFormatter / 使用者 Locale。
    private static func groupThousands(_ value: UInt) -> String {
        let digits = Array(String(value))
        var out = ""
        out.reserveCapacity(digits.count + digits.count / 3)
        for (index, digit) in digits.enumerated() {
            if index > 0 && (digits.count - index) % 3 == 0 {
                out.append(",")
            }
            out.append(digit)
        }
        return out
    }
}
