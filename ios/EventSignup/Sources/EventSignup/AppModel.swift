import Foundation
import SwiftUI

@MainActor
public final class AppModel: ObservableObject {
    @Published public var loggedIn: Bool
    public let client: Client
    let store: TokenStore

    public init(baseURL: URL = URL(string: "http://127.0.0.1:8788")!, store: TokenStore = .shared) {
        self.store = store
        self.client = makeAuthedClient(baseURL: baseURL, store: store)
        self.loggedIn = store.refresh != nil
    }

    public func didLogin(_ pair: Components.Schemas.TokenPair) {
        store.save(access: pair.access_token, refresh: pair.refresh_token)
        loggedIn = true
    }

    /// 登出要先讓伺服器撤銷 refresh。連不上就保留登入狀態並回 false(T084):
    /// 只清本機的話,伺服器那顆 refresh 30 天內還能用。伺服器有回應(含 401 已失效)才清本機。
    @discardableResult
    public func logout() async -> Bool {
        if let r = store.refresh {
            do { _ = try await client.logout(body: .json(.init(refresh_token: r))) } catch { return false }
        }
        store.clear(); OrdersCache.clear(); loggedIn = false
        return true
    }
}

func epochDate(_ ms: Int64) -> String {
    Date(timeIntervalSince1970: TimeInterval(ms) / 1000).formatted(date: .abbreviated, time: .shortened)
}
