import AppKit
import UniVerseCore
import ExpoModulesCore

enum ChromeWindows {
  static func makeWindow(profile: String?, chromeWindow: String? = nil, appWindow: String? = nil) -> NSWindow? {
    let profile = profile ?? ""
    installCloseHandler()
    if let appWindow {
      return UniVerseChromeWindowHost.makeWindow(forProfile: profile, chromeWindow: chromeWindow, appWindow: appWindow)
    }
    if let chromeWindow {
      return UniVerseChromeWindowHost.makeWindow(forProfile: profile, chromeWindow: chromeWindow)
    }
    return UniVerseChromeWindowHost.makeWindow(forProfile: profile)
  }

  private static var closeHandlerInstalled = false
  private static func installCloseHandler() {
    guard !closeHandlerInstalled else { return }
    closeHandlerInstalled = true
    UniVerseChromeWindowHost.shouldCloseHandler = { WindowManager.shared.windowShouldClose($0) }
    UniVerseChromeWindowHost.refusesUnhandledKeyHandler = { FocusHandoff.shared.refusesUnhandledKey($1, in: $0) }
  }

  private static let drawnMoves = LaunchConfig.shared.switchOn("sidebarSlideLean")

  static func setTrafficLightsCenter(_ center: NSPoint?, trailing: Bool, in window: NSWindow) {
    let value = center.map { NSValue(point: $0) }
    if drawnMoves {
      UniVerseChromeWindowHost.moveTrafficLightsCenter(value, trailing: trailing, in: window)
    } else {
      UniVerseChromeWindowHost.setTrafficLightsCenter(value, trailing: trailing, in: window)
    }
  }

  private static var swapHandlerInstalled = false
  static func onSwap(_ handler: @escaping (NSWindow, NSWindow) -> Void) {
    guard !swapHandlerInstalled else { return }
    swapHandlerInstalled = true
    UniVerseChromeWindowHost.swappedHandler = handler
  }
}
