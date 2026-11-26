import AppKit
import UniVerseCore
import UniVerseSync

UniVerseHost.markMainStarted()

let config = LaunchConfig.shared
if config.prewarm { exit(0) }

LegacyMigration.moveToNewName()

let scratch = config.dataDirectory.map {
  LegacyMigration.ScratchInstance(
    dataDirectory: $0, legacySource: config.testValue("legacySource"), crashAfter: config.testValue("legacyCrashAfter"))
}
if !LegacyMigration.runAtLaunch(scratch: scratch) { exit(0) }

exit(UniVerseHost.run(argc: CommandLine.argc, argv: CommandLine.unsafeArgv) { AppDelegate() })
