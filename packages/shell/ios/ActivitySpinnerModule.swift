import AppKit
import Carbon.HIToolbox
import ExpoModulesCore

public class ActivitySpinnerModule: Module {
  public func definition() -> ModuleDefinition {
    Name("UniVerseActivitySpinner")

    View(ActivitySpinner.self) {}
  }
}
