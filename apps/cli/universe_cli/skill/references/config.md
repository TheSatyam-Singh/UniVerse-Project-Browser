# Config and themes

When the user wants a setting changed for good, or set up from their dotfiles, edit `~/.config/universe/config.json`
with `universe config` instead of clicking through Settings. UniVerse Project Browser reads the file at launch and whenever it changes,
and never writes it; these commands don't need UniVerse Project Browser running.

```sh
universe config init
universe config list
universe config set tabLayout top
universe config set shortcuts.newTab cmd+shift+n
universe config unset tabLayout
universe config check
```

`init` creates the folder, `config.json` and the schemas; `list` shows every setting with its allowed values,
default and file value; shortcuts are one per command (`''` unbinds); `unset` leaves UniVerse Project Browser's current value in place;
`check` reports what UniVerse Project Browser would complain about.

Themes live in `~/.config/universe/themes/NAME.json`: `dark` and `light` colour roles, plus `type` (font `family`,
`mono`, `scale`, `sizes`, `weights`), `metrics` (`rowHeight`, `rowGap`, `pinnedHeight`, `sidebarWidth`, `radius`),
`layout` (`hide` sidebar parts, `addressField` and `newTab` top or bottom) and `icons` (SF Symbol swaps). Every key
is optional; a block left out is UniVerse Project Browser's own look. `universe theme new NAME` writes every role and look key with
UniVerse Project Browser's values, so change only the ones the user asked about and delete the rest if they like; the ranges and
defaults are in `theme.schema.json`. `universe theme use NAME` (or `none`) picks one, and `universe theme check` checks it
in UniVerse Project Browser's words; a bad key is skipped on its own and the rest applies. Saving the active theme restyles UniVerse Project Browser at
once. Ask before replacing the user's
own theme or config values. Settings that grant control or send data somewhere (`cliControl`, custom search URLs,
page engines) can't go in the file; tell the user where they are in Settings instead.

To land on a new tab at launch while keeping the session, set `launchActions`:
`universe config set launchActions '["newTab"]'`.
