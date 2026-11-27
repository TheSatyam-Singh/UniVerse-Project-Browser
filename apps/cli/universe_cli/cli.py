import sys

from universe_cli import __version__

DESCRIPTION = (
    "Control a running UniVerse Project Browser from the terminal. universe browse drives the browser (universe browse --help); "
    "universe computer operates native Mac apps through the bundled cua-driver (universe computer --help)."
)
EPILOG = """\
Shared options go before the command or after it, for the commands that take them:
  --port N        a plain DevTools server on 127.0.0.1:N (testing; $UNIVERSE_PORT)
  --ws URL        a browser WebSocket URL ($UNIVERSE_WS)
  --data-dir DIR  the UniVerse Project Browser data dir ($UNIVERSE_DATA_DIR, else the installed app's)
  --timeout S     and --json
A flag wins over its environment variable.

Examples:
  universe --port 9222 browse snapshot -i
  universe browse --port 9222 snapshot -i
  universe windows --json
  universe tabs --json
  universe groups create tab-1 tab-2 --name Work --icon 🚀
"""
SKILLS_DESCRIPTION = """\
Install the universe agent skill (SKILL.md and its references) so coding agents know how to drive UniVerse Project Browser.

Targets and where they install (user level; --project uses the current directory):
  general       ~/.agents/skills            ./.agents/skills
  codex         ~/.agents/skills            ./.agents/skills
  claude-code   ~/.claude/skills            ./.claude/skills
  cursor        ~/.cursor/skills            ./.cursor/skills
  opencode      ~/.config/opencode/skills   ./.opencode/skills

Next to each one it installs cua-driver's own skill (cua-driver, for computer use in native apps through
universe computer), pinned to the bundled driver; --no-cua skips it. A cua-driver skill that universe didn't install, from
cua's own installer for one, is left alone.

Installing or updating the CLI runs `universe skills install --auto`: the skill goes to every coding agent found here
(Claude Code, Codex, Cursor, opencode; general when none is), never over a folder universe didn't write, and not again where
the user removed it.
UniVerse Project Browser remembers where it installed the skill, and each CLI update rewrites those copies (universe skills refresh).
"""
SHARED_VALUE_FLAGS = frozenset({"--port", "--ws", "--data-dir", "--timeout"})
SHARED_BOOL_FLAGS = frozenset({"--json"})
BROWSE_SHARED_FLAGS = frozenset({"--port", "--ws", "--data-dir", "--json"})
REMOVED_COMMANDS = {
    "exec": (
        "universe: unknown command 'exec': it was removed. Drive the browser with universe browse (universe browse --help); "
        "universe pinned and universe history read favorites and history; universe run, windows and events reach UniVerse Project Browser's "
        "commands, windows and events."
    ),
}


class UsageError(Exception):
    pass


def take_shared(argv: list[str], index: int, into: list[str]) -> int:
    while index < len(argv):
        token = argv[index]
        name = token.split("=", 1)[0]
        if name in SHARED_VALUE_FLAGS:
            if "=" in token:
                into.append(token)
                index += 1
                continue
            if index + 1 >= len(argv):
                raise UsageError(f"{name} needs a value")
            into.extend(argv[index:index + 2])
            index += 2
            continue
        if token in SHARED_BOOL_FLAGS:
            into.append(token)
            index += 1
            continue
        break
    return index


def flag_names(flags: list[str]) -> list[str]:
    return [token.split("=", 1)[0] for token in flags if token.startswith("--")]


def subcommands(parser) -> dict:
    import argparse

    for action in parser._actions:
        if isinstance(action, argparse._SubParsersAction):
            return action.choices
    return {}


def arrange(parser, argv: list[str]) -> tuple[list[str], list[str], list[str]]:
    path: list[str] = []
    hoisted: list[str] = []
    index = 0
    current = parser
    while choices := subcommands(current):
        index = take_shared(argv, index, hoisted)
        if index >= len(argv) or argv[index] not in choices:
            break
        path.append(argv[index])
        current = choices[argv[index]]
        index += 1
    return path, hoisted, argv[index:]


def check_takes(parser, path: list[str], hoisted: list[str]) -> None:
    leaf = parser
    for name in path:
        leaf = subcommands(leaf)[name]
    for name in flag_names(hoisted):
        if name not in leaf._option_string_actions:
            raise UsageError(f"{' '.join(path)} doesn't take {name}")


def browse_argv(hoisted: list[str], rest: list[str], env) -> list[str]:
    for name in flag_names(hoisted):
        if name not in BROWSE_SHARED_FLAGS:
            raise UsageError(f"universe browse doesn't take {name}")
    argv = hoisted + rest
    from universe_cli.browse.cli import split_globals
    from universe_cli.browse.errors import Usage

    try:
        found, _ = split_globals(argv)
    except Usage:
        return argv
    if found.keys() & {"ws", "port", "cdp"}:
        return argv
    if env.get("UNIVERSE_WS"):
        return ["--ws", env["UNIVERSE_WS"], *argv]
    if env.get("UNIVERSE_PORT"):
        return ["--port", env["UNIVERSE_PORT"], *argv]
    return argv


def run_browse(hoisted: list[str], rest: list[str]) -> int:
    import os

    try:
        argv = browse_argv(hoisted, rest, os.environ)
    except UsageError as error:
        sys.stderr.write(f"✗ {error}\n")
        return 1
    from universe_cli import telemetry
    from universe_cli.browse.cli import main as browse_main

    telemetry.note_browse(argv)
    return browse_main(argv)


def run_notes(hoisted: list[str], rest: list[str]) -> int:
    import importlib

    from universe_cli import telemetry

    notes = importlib.import_module("universe_cli.notes")

    telemetry.note_browse(hoisted + rest, command="notes")
    return notes.main(hoisted + rest)


def build_parser():
    import argparse

    parser = argparse.ArgumentParser(prog="universe", description=DESCRIPTION, epilog=EPILOG, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--version", action="version", version=f"universe {__version__}")
    commands = parser.add_subparsers(dest="command", metavar="<command>")
    commands.add_parser("browse", help="drive the browser with agent-browser's commands (universe browse --help)", add_help=False)
    commands.add_parser("notes", help="read and write notes (universe notes --help)", add_help=False)
    commands.add_parser("computer", help="operate native Mac apps through the bundled cua-driver: computer use (universe computer --help)", add_help=False)

    from universe_cli import browsing_cli

    browsing_cli.add_parsers(commands, argparse.RawDescriptionHelpFormatter)

    skills = commands.add_parser("skills", help="install the universe agent skill")
    skill_commands = skills.add_subparsers(dest="skills_command", metavar="<command>")
    install = skill_commands.add_parser(
        "install",
        help="install the skill for one or more agents",
        description=SKILLS_DESCRIPTION,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    from universe_cli.skills import TARGETS

    install.add_argument("--target", action="append", choices=sorted(TARGETS), metavar="TARGET", help="general, codex, claude-code, cursor or opencode; repeat for several (default: general)")
    install.add_argument("--project", action="store_true", help="install into the current directory's project folders")
    install.add_argument("--no-cua", action="store_true", help="don't install cua-driver's computer-use skill next to it")
    install.add_argument("--replace", action="store_true", help="replace an universe folder that universe didn't install (only that folder)")
    install.add_argument("--auto", action="store_true", help="install for every coding agent found on this Mac (or general when none is), skipping folders universe didn't write and copies the user removed")
    skill_commands.add_parser("refresh", help="rewrite every copy of the skill installed before with this CLI's version")

    from universe_cli import scripts_cli

    scripts_cli.add_parser(commands, argparse.RawDescriptionHelpFormatter)

    from universe_cli import config_cli

    config_cli.add_parsers(commands, argparse.RawDescriptionHelpFormatter)

    from universe_cli import automation_cli

    automation_cli.add_parsers(commands, argparse.RawDescriptionHelpFormatter)

    from universe_cli import workspace_cli

    workspace_cli.add_parsers(commands, argparse.RawDescriptionHelpFormatter)

    from universe_cli import feedback, star

    feedback.add_parser(commands, argparse.RawDescriptionHelpFormatter)
    star.add_parser(commands, argparse.RawDescriptionHelpFormatter)
    return parser


def command_label(path: list[str], rest: list[str]) -> list[str]:
    if path:
        return path[:2]
    if rest and not rest[0].startswith("-"):
        return [rest[0] if rest[0] in REMOVED_COMMANDS else "unknown"]
    return ["none"]


def option_names(parser, path: list[str]) -> set[str]:
    names = set(parser._option_string_actions)
    for name in path:
        parser = subcommands(parser)[name]
        names |= set(parser._option_string_actions)
    return names


def main(argv: list[str] | None = None) -> int:
    argv = sys.argv[1:] if argv is None else argv
    if argv == ["--version"]:
        print(f"universe {__version__}")
        return 0
    from universe_cli import printable, telemetry

    try:
        index = take_shared(argv, 0, [])
    except UsageError:
        index = len(argv)
    browse_renders_its_own = index < len(argv) and argv[index] in ("browse", "notes")
    with printable.inert_output(json_stdout=browse_renders_its_own or printable.json_requested(argv)):
        return telemetry.track(argv, lambda: run_to_closed_pipe(argv))


def run_to_closed_pipe(argv: list[str]) -> int:
    from universe_cli import printable, telemetry

    try:
        status = run(argv)
        sys.stdout.flush()
        return status
    except BrokenPipeError:
        printable.quiet_stdout()
        telemetry.note_error_code("stdout_closed")
        return 141


def run(argv: list[str]) -> int:
    from universe_cli import telemetry

    leading: list[str] = []
    try:
        index = take_shared(argv, 0, leading)
    except UsageError as error:
        sys.stderr.write(f"universe: {error}\n")
        return 2
    command = argv[index] if index < len(argv) else None
    if command == "browse":
        return run_browse(leading, argv[index + 1:])
    if command == "notes":
        return run_notes(leading, argv[index + 1:])
    if command == "computer":
        if leading:
            sys.stderr.write(f"universe: computer doesn't take {flag_names(leading)[0]}\n")
            return 2
        from universe_cli import computer

        return computer.main(argv[index + 1:])
    parser = build_parser()
    try:
        path, hoisted, rest = arrange(parser, argv)
        telemetry.note_command(*command_label(path, rest), allowed_flags=option_names(parser, path))
        if path:
            check_takes(parser, path, hoisted)
    except UsageError as error:
        sys.stderr.write(f"universe: {error}\n")
        return 2
    if not path and rest and not rest[0].startswith("-"):
        telemetry.note_error_code("removed_command" if rest[0] in REMOVED_COMMANDS else "unknown_command")
        sys.stderr.write(REMOVED_COMMANDS.get(rest[0], f"universe: unknown command '{rest[0]}' (see universe --help)") + "\n")
        return 2
    argv = path + hoisted + rest if path else rest
    from universe_cli.automation_cli import split_program

    argv, program = split_program(argv)
    args = parser.parse_args(argv)
    args.program = program
    if args.command in ("pinned", "history"):
        from universe_cli import browsing_cli

        return browsing_cli.run(args)
    if args.command == "skills":
        if args.skills_command not in ("install", "refresh"):
            parser.parse_args(["skills", "--help"])
        from universe_cli import skills

        if args.skills_command == "refresh":
            return skills.refresh()
        if args.auto:
            return skills.install_detected(not args.no_cua)
        return skills.install(args.target or ["general"], args.project, not args.no_cua, args.replace)
    if args.command == "scripts":
        from universe_cli import scripts_cli

        return scripts_cli.run(args, parser)
    if args.command in ("run", "commands", "windows", "events", "on", "hooks"):
        from universe_cli import automation_cli

        return automation_cli.dispatch(args, parser)
    if args.command in ("tabs", "groups", "apply"):
        from universe_cli import workspace_cli

        return workspace_cli.run(args, parser)
    if args.command in ("config", "theme"):
        from universe_cli import config_cli

        return (config_cli.run_config if args.command == "config" else config_cli.run_theme)(args, parser)
    if args.command == "feedback":
        from universe_cli import feedback

        return feedback.run(args)
    if args.command == "star":
        from universe_cli import star

        return star.run(args)
    parser.print_help()
    return 0
