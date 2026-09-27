import Foundation
import HTTPTypes
import OpenAPIRuntime

/// 每個請求帶 access token;401 時用 refresh 換一次新的再重試一次(auth 那幾條除外)。
public struct BearerMiddleware: ClientMiddleware {
    let store: TokenStore
    let refresher: @Sendable (String) async throws -> Components.Schemas.TokenPair?

    public init(store: TokenStore = .shared,
                refresher: @escaping @Sendable (String) async throws -> Components.Schemas.TokenPair?) {
        self.store = store
        self.refresher = refresher
    }

    public func intercept(_ request: HTTPRequest, body: HTTPBody?, baseURL: URL, operationID: String,
                          next: @Sendable (HTTPRequest, HTTPBody?, URL) async throws -> (HTTPResponse, HTTPBody?))
        async throws -> (HTTPResponse, HTTPBody?) {
        var req = request
        if let token = store.access { req.headerFields[.authorization] = "Bearer \(token)" }
        let (res, resBody) = try await next(req, body, baseURL)
        let authOps: Set = ["login", "register", "refresh", "logout"]
        guard res.status.code == 401, !authOps.contains(operationID),
              let refresh = store.refresh, let pair = try await refresher(refresh) else {
            return (res, resBody)
        }
        store.save(access: pair.access_token, refresh: pair.refresh_token)
        req.headerFields[.authorization] = "Bearer \(pair.access_token)"
        return try await next(req, body, baseURL)
    }
}
