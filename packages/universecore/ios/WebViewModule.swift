import AppKit
import ExpoModulesCore

public class WebViewModule: Module {
  public func definition() -> ModuleDefinition {
    Name(Self.calls.moduleName)

    Self.calls.function

    PageViewDefinition.of(ChromiumTabView.self)
  }

  static func setting(_ apply: @escaping (CallArgs) throws -> Void) -> CallHandler {
    { args, reply in
      try apply(args)
      reply.ok()
    }
  }

  static let calls = CallTable(domain: "webView", handlers: [
    "setDisplayMediaPicker": setting { UniVerseWebView.setDisplayMediaPicker(try $0.bool("enabled")) },
    "setPeekModifier": setting { UniVerseWebView.setPeekModifier(try $0.text("modifier")) },
    "setSplitLinkModifier": setting { UniVerseWebView.setSplitLinkModifier(try $0.text("modifier")) },
    "setPeekOtherSiteTabs": setting { UniVerseWebView.setPeekOtherSiteTabs(try $0.strings("tabIds")) },
    "setSelectionPopover": setting { UniVerseWebView.setSelectionPopoverEnabled(try $0.bool("enabled")) },
    "setFingerprintProtection": setting { UniVerseWebView.setFingerprintProtectionEnabled(try $0.bool("enabled")) },
    "setCommandScrollZoom": setting { UniVerseWebView.setCommandScrollZoomEnabled(try $0.bool("enabled")) },
    "setLittleUniverseOpensNewTabLinks": setting { UniVerseWebView.setLittleUniverseOpensNewTabLinks(try $0.bool("enabled")) },
    "setAutoPictureInPicture": setting { UniVerseWebView.setAutoPictureInPictureEnabled(try $0.bool("enabled")) },
    "setVideoUpscaling": setting { UniVerseWebView.setVideoUpscalingEnabled(try $0.bool("enabled")) },
    "setVideoUpscalingTestConditions": setting { args in
      var conditions: [String: NSNumber] = [:]
      for key in ["lowPower", "thermalPressure"] { if let on = try args.optionalBool(key) { conditions[key] = NSNumber(value: on) } }
      UniVerseWebView.setVideoUpscalingTestConditions(conditions)
    },
    "videoUpscalingState": { _, reply in reply.ok(UniVerseWebView.videoUpscalingState()) },
  ])
}

