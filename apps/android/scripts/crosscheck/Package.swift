// swift-tools-version:5.9
import PackageDescription

let package = Package(
  name: "CrossCheck",
  platforms: [.macOS(.v14)],
  dependencies: [
    .package(name: "UniVerseSyncCore", path: "../../../../packages/sync"),
  ],
  targets: [
    .executableTarget(name: "CrossCheck", dependencies: [.product(name: "UniVerseSyncCore", package: "UniVerseSyncCore")]),
  ]
)
