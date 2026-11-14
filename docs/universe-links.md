# `universe://` deep links

UniVerse Project Browser answers `universe://` links from Raycast, Alfred, scripts and other apps.
They are off by default: turn them on in Tweaks (`allowUniverseLinks`, the same gate Nook used
for `nook://` links). While off, a `universe://` link does nothing.

## Commands

| Link | What it does |
| --- | --- |
| `universe://open?url=<url>&space=<space>&reuse=1` | Open the URL. `space` is a space name or id; without it the link follows the site-routing rules, then the last active space. `reuse=1` selects the tab already showing that page instead of opening a new one. |
| `universe://search?q=<query>&space=<space>` | Search with the default search engine. |
| `universe://space?name=<space>` | Switch to the named space (by name or id). |

The URL in `open` must be `http` or `https` with a host; anything else is rejected. A `space`
that is empty, oversized (over 8192 characters) or does not match a space rejects the whole link
rather than opening it somewhere else. Unknown parameters are ignored. The first value wins
when a parameter repeats.

Links never open in a private window. A `reuse=1` open only reuses a tab in a regular window
showing the same page (scheme and host case, the fragment and a trailing slash do not count).

## Examples

```sh
open "universe://open?url=https%3A%2F%2Fnews.example%2Ftech&space=Work&reuse=1"
open "universe://search?q=universe%20browser"
open "universe://space?name=Home"
```

## Raycast

The Raycast extension (`extras/raycast-universe/`) can open any of these with its
`open` command; a script command is just `open "universe://..."` as above.
