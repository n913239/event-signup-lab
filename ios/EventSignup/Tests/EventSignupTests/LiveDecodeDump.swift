import Foundation
import HTTPTypes
import OpenAPIRuntime
import Testing
@testable import EventSignup

/// SC-007 的 iOS 端:用產生的 Client 打線上 GET /events?status=on_sale 與 GET /orders,
/// 把**解碼後**的模型再編回 JSON(sortedKeys)寫檔,給 scripts/compare-clients.sh 跟 curl 逐欄比。
/// 只在給了 LIVE_BASE_URL / LIVE_ACCESS_TOKEN / LIVE_OUT_DIR 時跑,平常 swift test 會跳過。
struct Bearer: ClientMiddleware {
    let token: String
    func intercept(_ request: HTTPRequest, body: HTTPBody?, baseURL: URL, operationID: String,
                   next: @Sendable (HTTPRequest, HTTPBody?, URL) async throws -> (HTTPResponse, HTTPBody?)) async throws -> (HTTPResponse, HTTPBody?) {
        var r = request; r.headerFields[.authorization] = "Bearer \(token)"
        return try await next(r, body, baseURL)
    }
}

@Test(.enabled(if: ProcessInfo.processInfo.environment["LIVE_BASE_URL"] != nil))
func dumpDecodedLiveResponses() async throws {
    let env = ProcessInfo.processInfo.environment
    let client = makeClient(baseURL: URL(string: env["LIVE_BASE_URL"]!)!, middlewares: [Bearer(token: env["LIVE_ACCESS_TOKEN"]!)])
    let out = URL(fileURLWithPath: env["LIVE_OUT_DIR"]!)
    let enc = JSONEncoder(); enc.outputFormatting = [.sortedKeys, .prettyPrinted]

    guard case .ok(let ev) = try await client.listEvents(query: .init(status: .on_sale)) else { Issue.record("listEvents 不是 200"); return }
    try enc.encode(try ev.body.json).write(to: out.appendingPathComponent("ios-events.json"))
    guard case .ok(let od) = try await client.listOrders() else { Issue.record("listOrders 不是 200"); return }
    try enc.encode(try od.body.json).write(to: out.appendingPathComponent("ios-orders.json"))
}
