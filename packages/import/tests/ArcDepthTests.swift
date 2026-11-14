import Foundation
import XCTest
@testable import ArdiaImportCore

final class ArcDepthTests: XCTestCase {
  func testLinkRoutingKeepsContainsRulesAndCountsTheRest() throws {
    let data = try Data(contentsOf: Fixtures.url("arc-routing/StorableLinkRouting.json"))
    let routing = parseArcLinkRouting(data)
    XCTAssertEqual(routing.routes, [
      ArcRoute(pattern: "https://news.example/tech", spaceID: "SPACE-HOME"),
      ArcRoute(pattern: "mail.example", spaceID: "SPACE-WORK"),
      ArcRoute(pattern: "docs.example", spaceID: "SPACE-GONE"),
    ])
    XCTAssertEqual(routing.skipped, 2)
  }

  func testArchiveKeepsTabsWithAURL() throws {
    let data = try Data(contentsOf: Fixtures.url("arc-archive/StorableArchiveItems.json"))
    let items = parseArcArchive(data)
    XCTAssertEqual(items.count, 3)
    XCTAssertEqual(items[0].spaceID, "SPACE-HOME")
    XCTAssertEqual(items[0].url, "https://news.example/")
    XCTAssertEqual(items[0].title, "News")
    XCTAssertEqual(items[0].archivedAt, 800_000_000 + 978_307_200, accuracy: 0.001)
    XCTAssertTrue(items[0].auto)
    XCTAssertEqual(items[1].url, "https://work.example/")
    XCTAssertEqual(items[1].title, "Work")
    XCTAssertFalse(items[1].auto)
    XCTAssertEqual(items[2].url, "https://plain.example/")
    XCTAssertEqual(items[2].title, "")
    XCTAssertFalse(items[2].auto)
  }

  func testRoutingAndArchiveTolerateGarbage() {
    XCTAssertEqual(parseArcLinkRouting(Data("not json".utf8)).routes, [])
    XCTAssertEqual(parseArcArchive(Data("not json".utf8)), [])
  }
}
