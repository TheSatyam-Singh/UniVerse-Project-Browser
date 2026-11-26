import ExpoModulesCore

public class AutofillModule: Module {
  public func definition() -> ModuleDefinition {
    Name(Self.calls.moduleName)

    Self.calls.function

    AsyncFunction("saveCard") { (profile: String, card: [String: Any], number: String?, promise: Promise) in
      UniVerseServices.saveCard(card, number: number, profile: profile) { CallReply(promise: promise).service($0, $1) }
    }.runOnQueue(.main)
  }

  static let calls = CallTable(domain: "autofill", handlers: [
    "settings": { args, reply in
      reply.ok([
        "addresses": UniVerseServices.profileToggle(.addressesAutofilled, profile: args.profile),
        "cards": UniVerseServices.profileToggle(.cardsAutofilled, profile: args.profile),
      ])
    },
    "setSettings": { args, reply in
      let addresses = try args.optionalBool("addresses")
      let cards = try args.optionalBool("cards")
      if let addresses { UniVerseServices.setProfileToggle(.addressesAutofilled, value: addresses, profile: args.profile) }
      if let cards { UniVerseServices.setProfileToggle(.cardsAutofilled, value: cards, profile: args.profile) }
      reply.ok()
    },
    "addresses": { args, reply in UniVerseServices.addresses(profile: args.profile) { reply.service($0, $1) } },
    "saveAddress": { args, reply in UniVerseServices.saveAddress(try args.dict("address"), profile: args.profile) { reply.service($0, $1) } },
    "cards": { args, reply in UniVerseServices.cards(profile: args.profile) { reply.service($0, $1) } },
    "remove": { args, reply in UniVerseServices.deleteAutofillEntry(try args.text("id"), profile: args.profile) { reply.service($0, $1) } },
    "cardNumber": { args, reply in UniVerseServices.revealCardNumber(try args.text("id"), profile: args.profile) { reply.service($0, $1) } },
    "showSuggestions": { args, reply in
      reply.ok(UniVerseHost.showAutofillSuggestions(tabId: try args.text("tabId"), passwords: try args.bool("passwords")))
    },
  ])
}
