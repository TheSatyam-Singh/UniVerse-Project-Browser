import AppKit

extension UniVerseWebView: PageTab {
  func startPage() {}

  func closePage() { closeBrowser() }

  func downloadFavicon(_ url: String, completion: @escaping ([String: Any]?) -> Void) {
    downloadFavicon(url, name: nil, completion: completion)
  }
}
