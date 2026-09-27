import Foundation
import Testing
@testable import EventSignup

/// 讀 repo 根的 tests/fixtures/money-format.json:web 的 formatCents 與這裡必須逐字相同(SC-007)。
struct MoneyFixture: Decodable {
    struct Case: Decodable { let cents: Int; let text: String }
    let cases: [Case]
}

@Test func moneyMatchesWebFixture() throws {
    let url = URL(fileURLWithPath: #filePath)
        .deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()   // Tests/EventSignupTests → EventSignup
        .deletingLastPathComponent().deletingLastPathComponent()                               // → ios → repo 根
        .appendingPathComponent("tests/fixtures/money-format.json")
    let f = try JSONDecoder().decode(MoneyFixture.self, from: Data(contentsOf: url))
    #expect(f.cases.count > 10)
    for c in f.cases { #expect(Money.format(c.cents) == c.text, "\(c.cents)") }
}
