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

    public func logout() async {
        if let r = store.refresh { _ = try? await client.logout(body: .json(.init(refresh_token: r))) }
        store.clear(); OrdersCache.clear(); loggedIn = false
    }
}

func epochDate(_ ms: Int64) -> String {
    Date(timeIntervalSince1970: TimeInterval(ms) / 1000).formatted(date: .abbreviated, time: .shortened)
}
