import Foundation

/// iOS 唯一做「分 → 元」的地方。整數運算:用商與餘數拆,不經過 Double。
/// 千分位固定用逗號、自己拆 —— 不用 NumberFormatter:它跟裝置語系走(例如 de_DE 是句點),
/// 同一筆金額在 web 與 iOS 會長得不一樣(SC-007;spec-kit 重跑的 clarify 抓到)。
/// 輸出以 tests/fixtures/money-format.json 為準,web 與 iOS 各有一支測試讀它。
public enum Money {
    public static func format(_ cents: Int) -> String {
        let sign = cents < 0 ? "-" : ""
        let abs = Swift.abs(cents)
        let (yuan, rest) = abs.quotientAndRemainder(dividingBy: 100)
        return rest == 0 ? "\(sign)NT$\(grouped(yuan))" : "\(sign)NT$\(grouped(yuan)).\(rest < 10 ? "0" : "")\(rest)"
    }

    static func grouped(_ n: Int) -> String {
        let digits = Array(String(n))
        var out = ""
        for (i, d) in digits.enumerated() {
            if i > 0 && (digits.count - i) % 3 == 0 { out.append(",") }
            out.append(d)
        }
        return out
    }
}
