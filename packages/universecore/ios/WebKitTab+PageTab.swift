import AppKit

extension WebKitTab: PageTab {
  static let unsupported = "unsupported"

  var standalone: Bool { get { false } set {} }
  var temporary: Bool { get { false } set {} }
  var temporarySource: String? { get { nil } set {} }
  var extensionHost: String? { get { nil } set {} }
  var warm: Bool { get { false } set {} }
  var neighbour: Bool { get { false } set {} }
  var pageColor: String? { get { nil } set {} }
  var contentsBackgroundColor: NSColor? { get { nil } set {} }
  var shownURL: String? { get { nil } set {} }
  var frozen: Bool { get { false } set {} }
  var mediaCaptureSourceId: String? { nil }

  func startPage() { start() }

  func closePage() {
    if Thread.isMainThread { return close() }
    DispatchQueue.main.async { self.close() }
  }

  func navigationEntries(_ completion: @escaping ([[String: Any]]) -> Void) { completion(navigationEntries()) }

  func securityInfo(_ completion: @escaping ([String: Any]) -> Void) { completion(securityInfo()) }

  func showDevTools(panel: String?) {}

  func downloadImage(_ url: String, maxPixels: Int, completion: @escaping ([String: Any]?) -> Void) {
    downloadFavicon(url, completion: completion)
  }

  func requestPictureInPicture(clickAt: Double, control: Int, _ completion: @escaping (Bool) -> Void) {
    setPictureInPicture(true) { completion($0 == .opened) }
  }

  func takeControlPress(clickAt: Double, control: Int) -> Bool { true }

  func exitPictureInPicture() { setPictureInPicture(false) { _ in } }

  func pageCookies(_ urls: [String], completion: @escaping ([[String: Any]]?) -> Void) {
    guard let store = webView?.configuration.websiteDataStore.httpCookieStore else { return completion([]) }
    let hosts = urls.compactMap { URL(string: $0)?.host?.lowercased() }
    store.getAllCookies { cookies in
      let matched = cookies.filter { cookie in hosts.contains { WebKitHub.covers(cookie.domain, host: $0) } }
      let dicts = matched.map { cookie in
        [
          "name": cookie.name,
          "value": cookie.value,
          "domain": cookie.domain,
          "path": cookie.path,
          "expires": cookie.expiresDate?.timeIntervalSince1970 ?? -1,
          "session": cookie.isSessionOnly,
          "httpOnly": cookie.isHTTPOnly,
          "secure": cookie.isSecure,
        ] as [String: Any]
      }
      DispatchQueue.main.async { completion(dicts) }
    }
  }

  func importCookies(_ cookies: [[String: Any]], completion: @escaping (Int) -> Void) { completion(0) }

  func openBlockedPopup(_ popupId: String, always: Bool) {}

  func resolvePasswordPrompt(_ action: String, username: String?, password: String?) {}

  func resolveAutofillPrompt(_ promptId: Int, action: String) {}

  func executeExtensionAction(_ extensionId: String) -> String? { nil }

  func resolveDisplayMedia(_ requestId: String, sourceId: String?, audio: Bool) {}

  func notificationAction(_ notificationId: String, action: String) {}

  func resolveUnresponsive(terminate: Bool) {}

  func discard(unload: Bool) -> String { Self.unsupported }
}
