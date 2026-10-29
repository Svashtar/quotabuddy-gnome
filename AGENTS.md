# AGENTS.md

GNOME Shell 51+ extension (`quotabuddy@svashta.com`) that shows Claude's usage limits (5-hour
session, week, model weeks) as rings in a top-bar pill, with a dropdown of pace, activity, cost
and projects. Plain ESM GJS, no build step, no npm dependencies.
GitHub: `Svashtar/quotabuddy-gnome` (not created yet).

- Design, data sources and roadmap: [PLAN.md](PLAN.md)
- Module map, processes, lifecycle: [docs/architecture.md](docs/architecture.md)
- User docs: [README.md](README.md), [docs/](docs/)
- Sister projects with the same conventions: `../traybuddy-gnome`, `../lightsbuddy-gnome`

## Layout
```
src/             the extension itself (this folder is what gets installed and packed)
  extension.js   shell entry: ClaudeProvider + Indicator
  prefs.js       preferences entry: Display, Data, About pages (src/prefs/)
  lib/           shared by every process; NO St/Clutter/Gtk/Adw imports; mostly pure
  providers/     shell-only data sources (claude.js)
  ui/            shell-only widgets (St/Clutter/PanelMenu)
  prefs/         prefs-only pages (Gtk/Adw)
  bridge/        statusline.js, run by Claude Code as its status line (gjs -m)
  worker/        scanLogs.js, run by the shell to read Claude Code's logs (gjs -m)
tests/           `gjs -m` unit tests for the pure lib/ modules (tests/harness.js)
tools/           prefs-preview.js
docs/  po/  .github/
```

## Commands
```sh
make test        # unit tests (gjs -m tests/*.test.js)
make lint        # npx eslint@9 . — must stay at 0 errors/warnings
make install     # symlink src/ into ~/.local/share/gnome-shell/extensions/
make pack        # dist/quotabuddy@svashta.com.shell-extension.zip (EGO / releases)
make pot         # regenerate po/quotabuddy.pot after changing UI strings
make ego-check   # test + lint + pack, then fail while any AI notice remains
GSETTINGS_BACKEND=memory GI_TYPELIB_PATH=/usr/lib/gnome-shell/girepository-1.0 \
  LD_LIBRARY_PATH=/usr/lib/gnome-shell gjs -m tools/prefs-preview.js <display|data|about> out.png
XDG_CACHE_HOME=/tmp/qb/c XDG_DATA_HOME=/tmp/qb/d gjs -m src/worker/scanLogs.js   # scan into scratch dirs
journalctl -b _COMM=gnome-shell -o cat --since -10min                            # shell log
```

## Testing realities
- **Wayland: changed shell JS only loads after the user logs out and in.** `make nested` needs
  `mutter-devkit` (not installed). Test pure logic with unit tests, prefs with
  `tools/prefs-preview.js`, the bridge and worker by running them with scratch `XDG_*` dirs,
  and ask the user to check the top bar after a re-login.
- The bridge and worker are separate processes: changes apply on their next run.
- Never run the worker or bridge against the user's real `~/.cache/quotabuddy` while testing
  unless asked; use scratch `XDG_CACHE_HOME` / `XDG_DATA_HOME` / `XDG_CONFIG_HOME`.
- The user runs Dash to Panel and a Catppuccin shell theme (user-theme). Scope CSS to
  `quotabuddy-*` classes. St CSS has no `color-mix()` or `opacity`; use `st-transparentize()`.
  **No negative margins**: St overflows the height to 2^32 and the whole menu silently fails to
  draw (the button still turns active).
  **No `letter-spacing`**: St measures labels without it, so the text gets cut off with "…".
  **Never set an actor's `min_width` above its natural width** without also setting
  `natural_width`: Clutter aborts the whole shell.
- Shell UI can be checked without a re-login in a throwaway headless shell:
  `dbus-run-session -- gnome-shell --headless --virtual-monitor 1280x800 --wayland-display=<short>`
  with scratch `XDG_DATA_HOME` (extension symlinked in), `XDG_CONFIG_HOME`
  (`GSETTINGS_BACKEND=keyfile` enabling it), `XDG_CACHE_HOME`, and a short `XDG_RUNTIME_DIR`
  (socket path must stay under 108 bytes). A second scratch extension can open the menus and
  `print()` actor sizes.

## Claude data rules
- **Never print, log or store the OAuth token.** Read `.credentials.json` for
  `subscriptionType` / `rateLimitTier` only; the token only while direct mode is on and
  accepted, in memory, sent only to `api.anthropic.com`. Never refresh or write it.
- Only the prefs Data page writes Claude Code's `settings.json`, only the `statusLine` key,
  after the user confirmed the shown change, with a one-time `.quotabuddy-backup` copy.
- The bridge saves limits, model id and time only (`bridgeRecord`); never prompts or paths.
- Log replies are logged once per content block: dedupe on `message.id` + `requestId`;
  skip `<synthetic>` models.
- Prices in `lib/pricing.js` are dated (`PRICES_AS_OF`); update from the claude-api skill.
- Debug info never contains tokens, project names, paths or usage figures.

## extensions.gnome.org rules
Follow https://gjs.guide/extensions/review-guidelines/review-guidelines.html and
https://gjs.guide/extensions/review-guidelines/best-practices.html:
- **AI notice:** every file in `src/` carries the three-line notice. **Never remove it**; the
  maintainer does after review, then runs `make ego-check`.
- Nothing created before `enable()`; `disable()` removes every source, monitor, request,
  subprocess and signal, then destroys widgets.
- No private shell internals, no monkey-patching, no decorative comment dividers, comments
  explain why. `metadata.json`: no `version` key; the description declares clipboard use.
- ESLint enforces process separation (`src/lib`, `bridge`, `worker`: no UI toolkits;
  `src/ui`, `providers`: no Gtk/Adw; `src/prefs`: no St/Clutter/Meta/Shell).

## Code rules
- Pure `lib/` modules get a unit test for every change.
- Every user-facing string goes through `_()`; British spelling; short strings; `make pot`.
- `connectObject()` is shell-only; prefs uses `connect()` and disconnects on `close-request`.

## Finishing a change
- Run `make test` and `make lint`.
- User-visible change → update the owning `docs/` page and `## [Unreleased]` in `CHANGELOG.md`.
- Commit locally. **Do not push** unless the user asks.
- Say plainly what was verified and what still needs a re-login to check.
