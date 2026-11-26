// swift-tools-version:5.9
import PackageDescription

let package = Package(
  name: "UniVerseImportCore",
  platforms: [.macOS(.v14)],
  products: [.library(name: "UniVerseImportCore", targets: ["UniVerseImportCore"])],
  targets: [
    .target(name: "UniVerseImportCore", path: "ios/Core", linkerSettings: [.linkedLibrary("sqlite3")]),
    .testTarget(
      name: "UniVerseImportCoreTests",
      dependencies: ["UniVerseImportCore"],
      path: "tests"
    ),
  ]
)
