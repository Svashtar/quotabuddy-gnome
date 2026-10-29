# Architecture

QuotaBuddy is plain ESM GJS with no build step. Three kinds of process run its code:

```
Claude Code ──stdin JSON──▶ bridge/statusline.js ──▶ ~/.cache/quotabuddy/claude-status.json ─┐
~/.claude/projects/*.jsonl ──▶ worker/scanLogs.js ──▶ ~/.local/share/quotabuddy/history.json ─┤
api.anthropic.com (direct mode, optional) ────────────────────────────────────────────────┤
                                                                                          ▼
                                       gnome-shell: providers/claude.js ──▶ ui/indicator.js, ui/popup.js
```

- **The bridge** runs after every Claude Code reply (`gjs -m`, ~20 ms). It writes the limits atomically and prints a status line, running the user's previous status line command if there was one.
- **The worker** runs in its own process because logs grow by hundreds of megabytes a week. It reads only bytes added since its last run (offsets in `scan-state.json`), skips lines without usage before parsing them, drops duplicate replies by message id + request id, and merges the rest into the history. The first run reads the last 35 days (about 3 GB here in 4 s); later runs take milliseconds.
- **The shell** never parses logs. `ClaudeProvider` watches the bridge, history, credentials and Claude settings files, starts the worker every 2 minutes and 15 s after a new bridge reading (one at a time), and polls the usage service in direct mode.

## Modules

| Module | Process | Role |
|---|---|---|
| `lib/limits.js` | any, pure | Status line and direct-mode responses → one window model `{id, kind, usedPct, resetsAt, updatedAt, source}`; newest reading per window wins; expired windows reset |
| `lib/pace.js` | any, pure | Even-pace position, burn rate (session: last hour; week: since start), forecast status and when 100 % is reached |
| `lib/logParser.js` | any, pure | One transcript line → usage event |
| `lib/history.js` | any, pure | Hourly/daily/session buckets, pruning, series for charts, summaries, rankings |
| `lib/pricing.js` | any, pure | API list prices (dated), cost per reply, model labels and families |
| `lib/plan.js` | any, pure | Plan name from `subscriptionType` / `rateLimitTier` |
| `lib/statusLineSetup.js` | any, pure | Install/remove the bridge in Claude's `settings.json`; the bridge's own line and record |
| `lib/format.js` | any, pure | Tokens, money, clock times |
| `lib/settingsBackup.js`, `lib/debugInfo.js`, `lib/markdown.js` | any, pure | About page helpers |
| `lib/paths.js` | any | File locations, atomic writes |
| `providers/claude.js` | shell | All Claude data for the UI: `windows`, `plan`, `history`, `spend`, `status`, `forecast()`, `refresh()` |
| `ui/gauge.js`, `ui/gaugeDraw.js`, `ui/chart.js` | shell | Cairo ring/bar (drawing kept free of St so it can be rendered to an image for checking) and stacked columns; colours from CSS, light-mode overrides in `stylesheet-light.css` |
| `ui/indicator.js` | shell | The `PanelMenu.Button` and its pill |
| `ui/popup.js` | shell | The dropdown, rebuilt on open, on new data and every 30 s while open |
| `prefs/*.js` | prefs | Display, Data (bridge installer, direct mode warning), About |

Another provider (for example Codex CLI) would be a new `providers/*.js` with the same getters.

## Lifecycle

`enable()` creates the provider and the indicator, adds the indicator to the panel, then starts the provider (monitors, timers, first reads, first scan). `disable()` destroys the provider first (cancels reads, requests and the running worker, removes timers and monitors, saves pace samples), then the indicator.

## Direct mode safety

The token is only read while direct mode is on and accepted, lives in memory, and is never written or refreshed. 401/403 stops polling until Claude Code rewrites the credentials file; 429 and errors double the interval (up to 30 minutes) and honour `Retry-After`.
