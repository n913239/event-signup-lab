import Foundation
// 量測:讀共用向量 money-format.json,逐組比 Money.format 的輸出。
// 用 -AppleLocale de_DE 執行時,Locale.current 會是德文語系。
struct F: Decodable { struct C: Decodable { let cents: Int; let text: String }; let cases: [C] }
let path = CommandLine.arguments.count > 1 && !CommandLine.arguments[1].hasPrefix("-") ? CommandLine.arguments[1] : "money-format.json"
let f = try! JSONDecoder().decode(F.self, from: Data(contentsOf: URL(fileURLWithPath: path)))
var bad = 0
for c in f.cases {
    let got = Money.format(c.cents)
    if got != c.text { bad += 1; print("  ✗ \(c.cents): got \(got)  want \(c.text)") }
}
print("locale=\(Locale.current.identifier)  \(f.cases.count - bad)/\(f.cases.count) 相同")
