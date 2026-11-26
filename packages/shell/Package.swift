// swift-tools-version:5.9
import PackageDescription

let package = Package(
  name: "UniVerseUpdaterCore",
  platforms: [.macOS(.v14)],
  products: [
    .library(name: "UniVerseUpdaterCore", targets: ["UniVerseUpdaterCore"]),
    .library(name: "UniVerseTranslateCore", targets: ["UniVerseTranslateCore"]),
    .library(name: "UniVerseReportCore", targets: ["UniVerseReportCore"]),
  ],
  targets: [
    .target(name: "UniVerseUpdaterCore", path: "ios/UpdaterCore"),
    .testTarget(name: "UniVerseUpdaterCoreTests", dependencies: ["UniVerseUpdaterCore"], path: "tests"),
    .target(name: "UniVerseTranslateCore", path: "ios/TranslateCore"),
    .testTarget(name: "UniVerseTranslateCoreTests", dependencies: ["UniVerseTranslateCore"], path: "translate-tests"),
    .target(name: "UniVerseReportCore", path: "ios/ReportCore"),
    .testTarget(name: "UniVerseReportCoreTests", dependencies: ["UniVerseReportCore"], path: "report-tests"),
  ]
)
