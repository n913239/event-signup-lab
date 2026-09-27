import Foundation
import Security

/// access token 只放記憶體;refresh token 放 Keychain(登出或重放被撤銷時清掉)。
public final class TokenStore: @unchecked Sendable {
    public static let shared = TokenStore()
    private let lock = NSLock()
    private var _access: String?
    private let account = "refresh_token"
    private let service = "event-signup"

    public var access: String? {
        get { lock.withLock { _access } }
        set { lock.withLock { _access = newValue } }
    }

    public var refresh: String? {
        get {
            var q = baseQuery
            q[kSecReturnData as String] = true
            q[kSecMatchLimit as String] = kSecMatchLimitOne
            var out: CFTypeRef?
            guard SecItemCopyMatching(q as CFDictionary, &out) == errSecSuccess, let d = out as? Data else { return nil }
            return String(data: d, encoding: .utf8)
        }
        set {
            SecItemDelete(baseQuery as CFDictionary)
            guard let v = newValue else { return }
            var q = baseQuery
            q[kSecValueData as String] = Data(v.utf8)
            q[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
            SecItemAdd(q as CFDictionary, nil)
        }
    }

    public func save(access: String, refresh: String) { self.access = access; self.refresh = refresh }
    public func clear() { access = nil; refresh = nil }

    private var baseQuery: [String: Any] {
        [kSecClass as String: kSecClassGenericPassword,
         kSecAttrService as String: service,
         kSecAttrAccount as String: account]
    }
}
