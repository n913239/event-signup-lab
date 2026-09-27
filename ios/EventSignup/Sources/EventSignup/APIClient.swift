import Foundation
import OpenAPIRuntime
import OpenAPIURLSession

/// 由 openapi.yaml 產生的 Client。baseURL 指到 Worker(本機開發是 wrangler dev 的 8788)。
public func makeClient(baseURL: URL, middlewares: [any ClientMiddleware] = []) -> Client {
    Client(serverURL: baseURL, transport: URLSessionTransport(), middlewares: middlewares)
}

/// App 用的 client:帶 BearerMiddleware;refresh 用另一個不帶 middleware 的 client,避免遞迴。
public func makeAuthedClient(baseURL: URL, store: TokenStore = .shared) -> Client {
    let bare = makeClient(baseURL: baseURL)
    let middleware = BearerMiddleware(store: store) { token in
        guard case .ok(let ok) = try await bare.refresh(body: .json(.init(refresh_token: token))) else {
            store.clear(); return nil
        }
        return try ok.body.json
    }
    return makeClient(baseURL: baseURL, middlewares: [middleware])
}
