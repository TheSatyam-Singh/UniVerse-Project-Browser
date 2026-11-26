// swift-tools-version:6.2
import PackageDescription

let package = Package(
  name: "UniVerseKit",
  platforms: [.iOS("27.0"), .macOS("27.0")],
  products: [
    .library(name: "UniVerseShared", targets: ["UniVerseShared"]),
    .library(name: "UniVerseSync", targets: ["UniVerseSync"]),
    .library(name: "UniVerseBrowser", targets: ["UniVerseBrowser"]),
    .library(name: "UniVerseDesign", targets: ["UniVerseDesign"]),
  ],
  dependencies: [
    .package(name: "UniVerseSyncCore", path: "../../../../packages/sync"),
  ],
  targets: [
    .target(name: "UniVerseShared", resources: [.copy("Scripts")]),
    .target(name: "UniVerseSync", dependencies: ["UniVerseShared", .product(name: "UniVerseSyncCore", package: "UniVerseSyncCore")]),
    .target(name: "UniVerseBrowser", dependencies: ["UniVerseShared", "UniVerseSync"], resources: [.copy("Blocking/FilterListCatalog.json")]),
    .target(name: "UniVerseDesign", dependencies: ["UniVerseBrowser", "UniVerseSync"]),
    .testTarget(name: "UniVerseSharedTests", dependencies: ["UniVerseShared"]),
    .testTarget(name: "UniVerseSyncTests", dependencies: ["UniVerseSync", .product(name: "UniVerseSyncCore", package: "UniVerseSyncCore")]),
    .testTarget(name: "UniVerseBrowserTests", dependencies: ["UniVerseBrowser"]),
    .testTarget(name: "UniVerseDesignTests", dependencies: ["UniVerseDesign"]),
  ]
)
