import ExpoModulesCore

public class SearchModule: Module {
  public func definition() -> ModuleDefinition {
    Name(Self.calls.moduleName)

    Self.calls.function
  }

  static let calls = CallTable(domain: "search", handlers: [
    "suggest": EngineCall.passing("ac_search_suggest"),
    "stopSuggest": EngineCall.passing("ac_search_suggest_stop"),
    "engines": { args, reply in UniVerseServices.searchEngineList(profile: args.profile) { reply.service($0, $1) } },
    "setEngineName": { args, reply in
      UniVerseWebView.setSearchEngineName(try args.text("name"))
      reply.ok()
    },
  ])
}
