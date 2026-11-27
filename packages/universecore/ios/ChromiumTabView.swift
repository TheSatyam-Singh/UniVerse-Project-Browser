import AppKit
import ExpoModulesCore

final class ChromiumTabView: PageTabHost, UniVerseWebViewDelegate {
  let onPageEvent = EventDispatcher()

  override var pageEventDispatcher: EventDispatcher { onPageEvent }

  override class func makePage() -> PageTab { UniVerseWebView(frame: .zero) }

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    (page as? UniVerseWebView)?.delegate = self
  }

  func webView(_ view: UniVerseWebView, event name: String, payload: [String: Any]) {
    send(name, payload: payload)
  }
}
