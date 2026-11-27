// swift-tools-version:5.9
import PackageDescription

let package = Package(
  name: "UniVerseSyncCore",
  platforms: [.macOS(.v14), .iOS(.v17)],
  products: [
    .library(name: "UniVerseSyncCore", targets: ["UniVerseSyncCore"]),
    .executable(name: "legacy-migration", targets: ["LegacyMigrationTool"]),
  ],
  targets: [
    .target(name: "UniVerseSyncCore", path: "ios/Core"),
    .executableTarget(name: "LegacyMigrationTool", dependencies: ["UniVerseSyncCore"], path: "tools/legacy-migration"),
    .testTarget(name: "UniVerseSyncCoreTests", dependencies: ["UniVerseSyncCore"], path: "tests", exclude: ["fixtures"]),
  ]
)
