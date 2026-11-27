import SwiftUI
import WidgetKit

@main
struct UniVerseWidgets: WidgetBundle {
  var body: some Widget {
    SearchWidget()
    MacTabsWidget()
    SearchLockScreenWidget()
    SearchLockScreenRectangularWidget()
    VoiceSearchLockScreenWidget()
    SearchControl()
    VoiceSearchControl()
    IncognitoTabControl()
  }
}
