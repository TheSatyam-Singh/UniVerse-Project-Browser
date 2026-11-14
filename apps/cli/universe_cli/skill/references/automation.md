# Tabs and groups, commands, windows, events and hooks

## Tabs and groups

`universe tabs` and `universe groups` do what the sidebar does (open, move, nest, pin, rename, set icons and colours,
mute, sleep, close) on tabs and groups by id, without changing the tab a window shows. Read the workspace first:

```sh
universe tabs --json        # windows › spaces (one per profile) › topApps, pinned, tabs; groups nest with items
universe tabs --flat --json # one object per tab: id, url, title, pin, group, window, profile, active, asleep
universe tabs --usage       # each tab's process: pid, CPU % of a core, memory, hottest first (--json: pid, cpu, memory)
universe tabs --pid 61234   # the tabs in that process, to name a pid from top or Activity Monitor
universe groups --json      # every group: id, name, icon, color, collapsed, pinned, parent, depth, tabs
```

```sh
universe tabs open https://a.example https://b.example --group Work  # background tabs, in that group
universe tabs move tab-1 tab-2 --group Work                           # into a group, by name or id
universe tabs move tab-3 --top                                        # out of every group
universe tabs move tab-4 --after tab-9                                # next to a tab, in its group
universe tabs pin tab-5 --row ; universe tabs sleep tab-6 ; universe tabs rename tab-7 "Inbox"
universe groups create tab-1 tab-2 --name Work --icon 🚀 --color blue --unpinned
universe groups update Work --collapse ; universe groups move Reading --parent Work ; universe groups ungroup Imported
```

For a whole layout, send one `universe apply` (a JSON list on stdin; `$N` is what operation N made: its group, else
its tabs). It checks every operation first, runs them in order, stops at the first that fails and says which ran;
`--json` returns the resulting tabs and groups, so verify from that.

```sh
universe apply --json <<'EOF'
[{"op": "group.create", "urls": ["https://a.example", "https://b.example"], "name": "Research", "pinned": false},
 {"op": "group.create", "parent": "$0", "tabs": ["tab-7", "tab-8"], "name": "Papers", "icon": "📚"},
 {"op": "group.update", "group": "$1", "collapsed": true},
 {"op": "tab.move", "tabs": ["tab-9"], "group": null}]
EOF
```

- Group arguments take a name (case-insensitive, in that window) or an id; a name two groups share fails with both
  ids. Groups made one after another from one group's tabs keep their order above it.
- New groups are pinned (as in the sidebar) unless `"pinned": false` or a `parent`. Icons: an emoji from UniVerse Project Browser's
  picker or `symbol:<SF Symbol>`; colours: neutral, none, grey, blue, red, yellow, green, pink, purple, cyan, orange.
- URLs: http, https, file, about:blank and universe://history, bookmarks, downloads, newtab only.
- Closing a group (`groups close`) keeps it in History › Recently Closed Groups; `delete` doesn't. Shared-folder
  groups and private windows are refused. Ask before closing or deleting what the user didn't name.

## Commands, windows, events and hooks

UniVerse Project Browser's own commands (new tab, toggle sidebar, select tab 3, split view and the rest of its menus) run with
`universe run`, without CDP. `universe commands` lists them with their variants; `universe windows` lists the windows and
their tabs, private windows never included. Prefer these to clicking through a page when the user asks UniVerse Project Browser to do
something to itself.

```sh
universe commands
universe run newTab
universe run selectTab 3
universe run togglePin --window 2 --tab 5
universe windows --json
universe events tab.navigated
```

To react to the browser (a tab opening, a page loading, media starting, a tab going idle, the Mac waking), write a
hook: a program that gets the event's JSON on stdin and `ARDIA_EVENT`, `ARDIA_URL`, `ARDIA_TITLE`, `ARDIA_TAB_ID`,
`ARDIA_WINDOW_ID` and `ARDIA_PROFILE` in its environment. Those values come from pages: a hook that prints them to a
terminal should escape control characters. `universe events --help` lists every event. URLs arrive
without their query and fragment unless the hook says `"fullUrls": true` (`--full-urls`); notifications, presence
(`user.idle`, `app.activated`, `system.sleep`…) come only when named, never through `"*"`. Try a hook with
`universe on tab.navigated --match 'https://*.youtube.com/*' -- ~/bin/yt-hook`, then put it in
`~/.config/ardia/hooks.json`:

```json
{
  "hooks": [
    { "name": "yt-to-media", "on": ["tab.navigated"], "match": ["https://*.youtube.com/*"], "run": ["~/bin/yt-hook"], "timeout": 30, "fullUrls": true },
    { "name": "park", "on": "tab.idle", "idle": "2h", "command": "togglePin" },
    { "name": "standup", "at": "09:55", "days": ["mon", "tue", "wed", "thu", "fri"], "run": ["~/bin/standup"] },
    { "name": "old-reddit", "on": "tab.opening", "rewrite": [{ "match": "https://www.reddit.com/*", "to": "https://old.reddit.com{path}{query}" }] },
    { "name": "no-camera", "on": "permission.requested", "kinds": ["camera"], "permission": "deny" }
  ]
}
```

- A hook has one trigger (`on`, `at` + optional `days`/`timezone`, `every`, or `omnibox`) and one action: `run`
  (argv), `command` (+ `arg`, an UniVerse Project Browser command id run in the event's window and tab, no process), or a decide answer.
- Decide hooks answer before UniVerse Project Browser acts: `tab.opening` (`rewrite`, `cancel`), `link.opening` from other apps
  (`route`, `drop`, `from`), `download.deciding` (`folder` under `~/Downloads`), `permission.requested`
  (`permission`: deny or ask). As rules UniVerse Project Browser applies them itself, even with control off; with `run`, the program's
  stdout JSON is the answer, within 250 ms for openings. Anything late or invalid means UniVerse Project Browser's default.
- Rules that rewrite to another site, route links, pick a folder outside Downloads, run a decide program or read
  the address bar (`omnibox` providers) stay off until the user approves them in Settings › Advanced › Automation.
  Tell the user that after writing one.

`run` is argv, not a shell line; use `["/bin/sh", "-c", "…"]` when you need one, and never paste event values
into it. `universe hooks list` checks the file, `universe hooks install` (ask first) runs the hooks at every login, and
their output goes to `~/Library/Logs/UniVerse Project Browser/hooks.log`.
