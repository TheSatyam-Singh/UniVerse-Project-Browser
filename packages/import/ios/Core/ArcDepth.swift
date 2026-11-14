import Foundation

public struct ArcRoute: Codable, Equatable, Sendable {
  public var pattern: String
  public var spaceID: String

  public init(pattern: String, spaceID: String) {
    self.pattern = pattern
    self.spaceID = spaceID
  }
}

public struct ArcArchivedItem: Codable, Equatable, Sendable {
  public var spaceID: String
  public var url: String
  public var title: String
  public var archivedAt: Double
  public var auto: Bool

  public init(spaceID: String, url: String, title: String, archivedAt: Double, auto: Bool) {
    self.spaceID = spaceID
    self.url = url
    self.title = title
    self.archivedAt = archivedAt
    self.auto = auto
  }
}

struct ArcRouting: Equatable {
  var routes: [ArcRoute] = []
  var skipped = 0
}

private func tagKey(_ value: Any?) -> String? {
  if let string = value as? String { return string }
  return (value as? [String: Any])?.keys.first
}

func parseArcLinkRouting(_ data: Data) -> ArcRouting {
  let root = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
  var routing = ArcRouting()
  for case let rule as [String: Any] in root?["rules"] as? [Any] ?? [] {
    let parts = rule["sourceComponents"] as? [[String: Any]] ?? []
    let match = (parts.first?["componentType"] as? [String: Any])?["urlMatch"] as? [String: Any]
    let target = (((rule["destination"] as? [String: Any])?["space"] as? [String: Any])?["_0"] as? [String: Any])?["space"] as? [String: Any]
    guard parts.count == 1, (match?["_0"] as? [String: Any])?.keys.first == "contains",
          let pattern = match?["_1"] as? String, let spaceID = target?["_0"] as? String
    else { routing.skipped += 1; continue }
    routing.routes.append(ArcRoute(pattern: pattern, spaceID: spaceID))
  }
  return routing
}

func parseArcArchive(_ data: Data) -> [ArcArchivedItem] {
  let root = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
  return ArcSidebar.objects(root?["items"]).compactMap { item in
    guard let spaceID = (((item["source"] as? [String: Any])?["space"] as? [String: Any])?["_0"]) as? String,
          let seconds = item["archivedAt"] as? Double,
          let sidebar = item["sidebarItem"] as? [String: Any],
          let tab = (sidebar["data"] as? [String: Any])?["tab"] as? [String: Any],
          let url = [tab["savedURL"], tab["currentURL"]].lazy.compactMap({ $0 as? String }).first(where: { !$0.isEmpty })
    else { return nil }
    let saved = tab["savedTitle"] as? String
    let name = (sidebar["title"] as? String).flatMap { $0.isEmpty ? nil : $0 }
    return ArcArchivedItem(spaceID: spaceID, url: url, title: name ?? saved ?? "",
                           archivedAt: Date(timeIntervalSinceReferenceDate: seconds).timeIntervalSince1970,
                           auto: tagKey(item["reason"]) == "auto")
  }
}
