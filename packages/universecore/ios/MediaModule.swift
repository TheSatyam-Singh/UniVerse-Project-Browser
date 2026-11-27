import ExpoModulesCore

public class MediaModule: Module {
  public func definition() -> ModuleDefinition {
    Name(Self.calls.moduleName)
    Events(Self.calls.domain)
    Self.calls.forwardEvents(to: self)

    Self.calls.function
  }

  static func chooser(_ action: String) -> CallHandler {
    { args, reply in
      UniVerseHost.deviceChooser(try args.int32("id"), action: action)
      reply.ok()
    }
  }

  static let calls = CallTable(domain: "media", handlers: [
    "displayMediaSources": { _, reply in reply.ok(UniVerseHost.displayMediaSources) },
    "screenRecordingAllowed": { _, reply in reply.ok(UniVerseHost.screenRecordingAllowed) },
    "requestScreenRecording": { _, reply in reply.ok(UniVerseHost.requestScreenRecording()) },
    "selectDevice": { args, reply in
      UniVerseHost.deviceChooser(try args.int32("id"), select: try args.int32("index"))
      reply.ok()
    },
    "cancelDeviceChooser": chooser("cancel"),
    "refreshDeviceChooser": chooser("refresh"),
    "openBluetoothSettings": chooser("settings"),
    "devShowBluetoothChooser": { args, reply in
      reply.ok(UniVerseHost.devShowBluetoothChooser(tabId: try args.text("tabId"), unauthorized: try args.bool("unauthorized")))
    },
    "devChooserEvents": { _, reply in reply.ok(UniVerseHost.testChooserEvents()) },
    "showCastDialog": { args, reply in reply.ok(UniVerseHost.showCastDialog(tabId: try args.text("tabId"))) },
    "startCasting": { args, reply in
      UniVerseHost.castDialog(try args.int32("id"), start: try args.text("sink"), mode: try args.int32("mode"))
      reply.ok()
    },
    "stopCasting": { args, reply in
      UniVerseHost.castDialog(try args.int32("id"), stop: try args.text("route"))
      reply.ok()
    },
    "closeCastDialog": { args, reply in
      UniVerseHost.closeCastDialog(try args.int32("id"))
      reply.ok()
    },
    "watchCastRoutes": { args, reply in
      UniVerseHost.watchCastRoutes(args.profile)
      reply.ok()
    },
    "terminateCastRoute": { args, reply in
      UniVerseHost.terminateCastRoute(try args.text("route"))
      reply.ok()
    },
    "changeCaptureSource": { args, reply in
      reply.ok(UniVerseHost.shareTabInstead(capturer: try args.text("capturer"), target: try args.text("target")))
    },
    "stopCapture": { args, reply in reply.ok(UniVerseHost.stopCapture(tabId: try args.text("tabId"))) },
  ])
}
