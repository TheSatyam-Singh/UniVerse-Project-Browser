# Userscripts

When the user wants a site to look or behave differently every time they visit it, write a userscript instead of
driving the page by hand. `universe scripts` takes TypeScript or JavaScript with a Violentmonkey `==UserScript==` header,
so existing `.user.js` files work too. `universe scripts --help` and each command's `--help` explain the details.

- Start from `universe scripts new`, or from a script the user already has.
- Read the real page (`universe browse snapshot`, `universe browse get html <sel>`) before writing selectors, and keep the
  script small and robust to the site changing.
- Iterate with `universe scripts test` until it passes cleanly on the pages it targets. It runs in a tab of its own and
  reports what ran, what logged and what threw.
- Install only once the user is happy with it. `universe scripts list` and `uninstall` manage what's installed.
