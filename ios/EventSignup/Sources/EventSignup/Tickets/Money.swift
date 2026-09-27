import Foundation

/// iOS 唯一做「分 → 元」的地方。整數運算:用商與餘數拆,不經過 Double。
public enum Money {
    public static func format(_ cents: Int) -> String {
        let sign = cents < 0 ? "-" : ""
        let abs = Swift.abs(cents)
        let (yuan, rest) = abs.quotientAndRemainder(dividingBy: 100)
        let f = NumberFormatter(); f.numberStyle = .decimal
        let y = f.string(from: NSNumber(value: yuan)) ?? String(yuan)
        return rest == 0 ? "\(sign)NT$\(y)" : "\(sign)NT$\(y).\(String(format: "%02d", rest))"
    }
}
