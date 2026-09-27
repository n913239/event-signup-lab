import Foundation

/// 最後一次 GET /orders 的結果存在 Application Support;離線時讀它並標「離線資料」。
public enum OrdersCache {
    static var url: URL {
        let dir = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir.appendingPathComponent("orders.json")
    }
    public static func save(_ orders: [Components.Schemas.Order]) {
        if let data = try? JSONEncoder().encode(orders) { try? data.write(to: url, options: .atomic) }
    }
    public static func load() -> [Components.Schemas.Order]? {
        guard let data = try? Data(contentsOf: url) else { return nil }
        return try? JSONDecoder().decode([Components.Schemas.Order].self, from: data)
    }
    public static func clear() { try? FileManager.default.removeItem(at: url) }
}
