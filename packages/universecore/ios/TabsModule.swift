import ExpoModulesCore

public class TabsModule: Module {
  public func definition() -> ModuleDefinition {
    Name(Self.calls.moduleName)
    Events(Self.calls.domain)
    Self.calls.forwardEvents(to: self)

    OnCreate {
      UniVerseTabStrip.watchStrips()
    }

    Function("prepareTransfer") { (key: String) in
      for engine in PageEngines.all { engine.prepareTransfer(key) }
    }
    Function("releaseTransfer") { (key: String) in
      for engine in PageEngines.all { engine.releaseTransfer(key) }
    }
    Function("claimLaunchTab") { (key: String, url: String, profile: String) in
      UniVerseWebView.claimLaunchTab(key, url: url, profile: profile)
    }
    Function("revealTab") { (key: String) in UniVerseWebView.revealTab(key) }
    Function("dropTabReveals") { (key: String) in UniVerseWebView.dropTabReveals(key) }
    Function("revealOffered") { (adoptId: String, key: String) in UniVerseWebView.revealOffered(adoptId, over: key) }
    AsyncFunction("discardOffered") { (adoptId: String) -> Bool in UniVerseWebView.discardOffered(adoptId) }.runOnQueue(.main)

    Self.calls.function
  }

  static func browserId(_ args: CallArgs) throws -> Int32 { UniVerseWebView.browserId(ofTab: try args.text("tabId")) }

  static let calls = CallTable(domain: "tabs", handlers: [
    "routeLinkTabs": { args, reply in reply.ok(UniVerseWebView.routeLinkTabs(try args.strings("urls"))) },
    "stripCommand": { args, reply in
      UniVerseTabStrip.command(try args.int("id"), command: try args.dict("command"))
      reply.ok()
    },
    "strips": { _, reply in reply.ok(UniVerseTabStrip.allStrips) },
    "reportCommits": { args, reply in
      UniVerseWebView.reportsCommits = try args.bool("on")
      reply.ok()
    },
    "lastTabPolicy": EngineCall.passing("ac_tabs_last_tab_policy"),
    "devBrowserId": { args, reply in reply.ok(try browserId(args)) },
    "devEvents": { args, reply in reply.ok(UniVerseWebView.devEvents(browserId: try browserId(args))) },
    "devWindowNumber": { args, reply in reply.ok(UniVerseWebView.devWindowNumber(browserId: try browserId(args))) },
    "devFocusPage": { args, reply in reply.ok(UniVerseWebView.devFocusPage(browserId: try browserId(args))) },
    "devPictureInPicture": { _, reply in reply.ok(UniVerseWebView.devPictureInPicture()) },
    "devPostPeekMouseUp": { args, reply in reply.ok(UniVerseWebView.devPostPeekMouseUp(try args.text("keys"), over: try args.text("tabId"))) },
    "devScrollZoom": { args, reply in
      let steps = try args.dicts("steps")
      reply.ok(UniVerseWebView.devScrollZoom(steps, browserId: UniVerseWebView.browserId(ofTab: try args.optionalText("tabId"))))
    },
  ].merging(LaunchConfig.shared.testInstance ? testInstanceCalls : [:]) { call, _ in call })

  private static let testInstanceCalls: [String: CallHandler] = [
    "devPictureInPictureAction": { args, reply in reply.ok(UniVerseWebView.devPictureInPictureAction(try args.text("action"))) },
    "devPagePhase": { args, reply in reply.ok(UniVerseWebView.devPagePhase(of: try args.text("tabId"))) },
    "devClosePage": { args, reply in reply.ok(UniVerseWebView.devClosePage(of: try args.text("tabId"))) },
  ]
}
