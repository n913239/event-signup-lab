import Foundation
import OpenAPIRuntime
import OpenAPIURLSession

/// 由 openapi.yaml 產生的 Client。baseURL 指到 Worker(本機開發是 wrangler dev 的 8788)。
public func makeClient(baseURL: URL, middlewares: [any ClientMiddleware] = []) -> Client {
    Client(serverURL: baseURL, transport: URLSessionTransport(), middlewares: middlewares)
}
