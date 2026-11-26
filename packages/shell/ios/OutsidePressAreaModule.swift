import AppKit
import Carbon.HIToolbox
import ExpoModulesCore

public class OutsidePressAreaModule: Module {
  public func definition() -> ModuleDefinition {
    Name("UniVerseOutsidePressArea")

    View(OutsidePressArea.self) {
      Events("onOutsidePress")
    }
  }
}
