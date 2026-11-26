import ExpoModulesCore

public class PasswordsModule: Module {
  public func definition() -> ModuleDefinition {
    Name(Self.calls.moduleName)

    Self.calls.function

    AsyncFunction("save") { (profile: String, origin: String, username: String, password: String, promise: Promise) in
      UniVerseServices.savePassword(profile: profile, origin: origin, username: username, password: password) {
        CallReply(promise: promise).service($0, $1)
      }
    }.runOnQueue(.main)

    AsyncFunction("update") {
      (profile: String, origin: String, username: String, newUsername: String?, newPassword: String?, promise: Promise) in
      UniVerseServices.updatePassword(profile: profile, origin: origin, username: username, newUsername: newUsername,
                                   newPassword: newPassword) { CallReply(promise: promise).service($0, $1) }
    }.runOnQueue(.main)
  }

  static let calls = CallTable(domain: "passwords", handlers: [
    "list": { args, reply in UniVerseServices.listPasswords(profile: args.profile) { reply.service($0, $1) } },
    "unlock": { args, reply in UniVerseServices.unlockPasswords(profile: args.profile) { reply.service($0, $1) } },
    "reveal": { args, reply in
      UniVerseServices.password(profile: args.profile, origin: try args.text("origin"), username: try args.text("username")) { reply.service($0, $1) }
    },
    "remove": { args, reply in
      UniVerseServices.deletePassword(profile: args.profile, origin: try args.text("origin"), username: try args.text("username")) { reply.service($0, $1) }
    },
    "neverSaveOrigins": { args, reply in UniVerseServices.neverSaveOrigins(profile: args.profile) { reply.service($0, $1) } },
    "allowSaving": { args, reply in UniVerseServices.allowSaving(profile: args.profile, origin: try args.text("origin")) { reply.service($0, $1) } },
    "export": { args, reply in UniVerseServices.exportPasswords(profile: args.profile, path: nil) { reply.service($0, $1) } },
    "autofillEnabled": { args, reply in reply.ok(UniVerseServices.profileToggle(.passwordsOffered, profile: args.profile)) },
    "setAutofillEnabled": { args, reply in
      UniVerseServices.setProfileToggle(.passwordsOffered, value: try args.bool("enabled"), profile: args.profile)
      reply.ok()
    },
  ])
}
