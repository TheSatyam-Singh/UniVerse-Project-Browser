import AppIntents
import SwiftUI
import WidgetKit

nonisolated protocol UniVerseControlIntent: AppIntent {}

nonisolated extension UniVerseControlIntent {
  func perform() async throws -> some IntentResult {
    .result()
  }
}

nonisolated struct SearchControlIntent: UniVerseControlIntent {
  static let title: LocalizedStringResource = "Search"
  static let isDiscoverable = false
  static let supportedModes: IntentModes = .foreground
}

nonisolated struct VoiceSearchControlIntent: UniVerseControlIntent {
  static let title: LocalizedStringResource = "Voice Search"
  static let isDiscoverable = false
  static let supportedModes: IntentModes = .foreground
}

nonisolated struct IncognitoControlIntent: UniVerseControlIntent {
  static let title: LocalizedStringResource = "New Incognito Tab"
  static let isDiscoverable = false
  static let supportedModes: IntentModes = .foreground
}

struct SearchControl: ControlWidget {
  var body: some ControlWidgetConfiguration {
    StaticControlConfiguration(kind: "com.universe.projectbrowser.ios.control.search") {
      ControlWidgetButton(action: SearchControlIntent()) {
        Label("Search", systemImage: "magnifyingglass")
      }
    }
    .displayName("Search")
    .description("Start a search in UniVerse Project Browser.")
  }
}

struct VoiceSearchControl: ControlWidget {
  var body: some ControlWidgetConfiguration {
    StaticControlConfiguration(kind: "com.universe.projectbrowser.ios.control.voice") {
      ControlWidgetButton(action: VoiceSearchControlIntent()) {
        Label("Voice Search", systemImage: "mic.fill")
      }
    }
    .displayName("Voice Search")
    .description("Search UniVerse Project Browser with your voice.")
  }
}

struct IncognitoTabControl: ControlWidget {
  var body: some ControlWidgetConfiguration {
    StaticControlConfiguration(kind: "com.universe.projectbrowser.ios.control.incognito") {
      ControlWidgetButton(action: IncognitoControlIntent()) {
        Label("Incognito Tab", systemImage: "eyes")
      }
    }
    .displayName("New Incognito Tab")
    .description("Open a private tab in UniVerse Project Browser.")
  }
}
