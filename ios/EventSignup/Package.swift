// swift-tools-version: 6.0
// iOS 骨架:client 由 repo 根的 openapi.yaml 產生(swift-openapi-generator 的 build plugin)。
import PackageDescription

let package = Package(
    name: "EventSignup",
    platforms: [.iOS(.v17), .macOS(.v14)],
    products: [.library(name: "EventSignup", targets: ["EventSignup"])],
    dependencies: [
        .package(url: "https://github.com/apple/swift-openapi-generator", from: "1.6.0"),
        .package(url: "https://github.com/apple/swift-openapi-runtime", from: "1.7.0"),
        .package(url: "https://github.com/apple/swift-openapi-urlsession", from: "1.0.2"),
    ],
    targets: [
        .target(
            name: "EventSignup",
            dependencies: [
                .product(name: "OpenAPIRuntime", package: "swift-openapi-runtime"),
                .product(name: "OpenAPIURLSession", package: "swift-openapi-urlsession"),
            ],
            plugins: [.plugin(name: "OpenAPIGenerator", package: "swift-openapi-generator")]
        ),
    ]
)
