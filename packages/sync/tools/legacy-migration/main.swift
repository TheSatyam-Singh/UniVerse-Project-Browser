import UniVerseSyncCore
import Foundation

switch CommandLine.arguments.dropFirst().first {
case "names":
  FileHandle.standardOutput.write(LegacyMigration.namesJSON())
case "run":
  let env = ProcessInfo.processInfo.environment
  guard let data = env["UNIVERSE_DATA_DIR"], !data.isEmpty else {
    FileHandle.standardError.write(Data("set UNIVERSE_DATA_DIR and UNIVERSE_LEGACY_SOURCE\n".utf8))
    exit(2)
  }
  let scratch = LegacyMigration.ScratchInstance(
    dataDirectory: data, legacySource: env["UNIVERSE_LEGACY_SOURCE"], crashAfter: env["UNIVERSE_LEGACY_CRASH_AFTER"])
  exit(LegacyMigration.runAtLaunch(scratch: scratch, bundleId: "com.universe.projectbrowser") ? 0 : 3)
case "move":
  let args = CommandLine.arguments
  if args.count == 4, args[2] == "--wait" {
    while !FileManager.default.fileExists(atPath: args[3]) { usleep(20_000) }
  }
  LegacyMigration.moveToNewName()
  let launched = LegacyMigration.launchedExecutable() ?? "?"
  print("at \(launched)|\(ProcessInfo.processInfo.environment["MOVE_MARK"] ?? "")|\(args.dropFirst().joined(separator: " "))")
default:
  FileHandle.standardError.write(Data("usage: legacy-migration names|run|move [--wait <file>]\n".utf8))
  exit(2)
}
