# QuotaBuddy — GNOME Shell extension

## Context
AI subscriptions come with usage limits that are easy to run into without noticing. Claude (Pro/Max) has a rolling **5-hour session** limit and a **weekly** limit, plus model-specific weekly limits on some plans (for example Fable). Claude Code shows them with `/usage`, but only when asked.

QuotaBuddy keeps them in the top bar as a pill of small rings, and opens a dropdown with the full picture and some analysis: pace, forecasts, activity charts, cost at API prices and the busiest projects.

The first provider is **Claude**. The code keeps providers behind one interface, so others (Codex CLI, Gemini CLI…) can be added later.

**Target:** GNOME Shell 51 and later (installed here: 51.1). ESM, `"shell-version": ["51"]`.

**Location:** `/home/svashtar/projects/development/GNOME/quotabuddy-gnome`

**Conventions:** same as `../traybuddy-gnome` and `../lightsbuddy-gnome`: layout, Makefile targets, ESLint config, test harness, About page, docs set, AI notice, commit locally, push only when asked.

## What data exists (researched 2026-10-29)

| Source | What it gives | Limits |
|---|---|---|
| **Claude Code status line** (documented, [statusline docs](https://code.claude.com/docs/en/statusline)) | `rate_limits.five_hour` and `rate_limits.seven_day`: `used_percentage` (0–100) and `resets_at` (epoch s); `model`, `cost.total_cost_usd` (session estimate) | Only while a Claude Code session runs on this computer, after its first reply; Pro/Max only; no per-model window; no plan name |
| **Claude Code logs** `~/.claude/projects/**/*.jsonl` | Every reply: `timestamp`, `message.model`, `message.usage` (input, output, cache read/write tokens), `cwd`, `sessionId`; subagents in `…/subagents/` | Only Claude Code on this computer (also the desktop app's Code tab), not claude.ai chats. Replies are logged **twice** (dedupe on `message.id` + `requestId`). Claude Code deletes logs after its cleanup period (30 days by default). ~750 MB per week here. |
| **Claude Code credentials** `~/.claude/.credentials.json` | Non-secret `claudeAiOauth.subscriptionType` (`max`) and `rateLimitTier` (`default_claude_max_5x`) → plan name "Max 5×" | The same file holds the login token: only these two fields are read by default |
| **Direct mode** (opt-in, undocumented) `GET https://api.anthropic.com/api/oauth/usage` | Account-wide, always fresh: `limits[]` with `kind` (`session`/`weekly_all`/`weekly_scoped`), `percent`, `severity`, `resets_at`, `scope.model.display_name` (Fable…); `spend` (extra usage); older flat `five_hour`/`seven_day`/`seven_day_<model>` keys | Needs Claude Code's OAuth token. **Against Anthropic's Consumer Terms** (Feb 2026: subscription OAuth tokens only for Claude Code/claude.ai), may change any day. Headers: `Authorization: Bearer`, `anthropic-beta: oauth-2025-04-20`, `anthropic-version: 2023-06-01` |

There is **no "Sign in with Claude"** for third-party apps, so QuotaBuddy never signs in on its own.

Reference for direct mode: [dvdstelt/ClaudeCodeUsage](https://github.com/dvdstelt/ClaudeCodeUsage) (also refreshes and writes back Claude Code's token; **QuotaBuddy never does**: it reads the token only, keeps it in memory, and waits for Claude Code to renew it).

## Key design decisions

| Topic | Decision, and why |
|---|---|
| Default data source | **Status-line bridge**: `src/bridge/statusline.js`, run by Claude Code as its status line, writes `~/.cache/quotabuddy/claude-status.json` atomically and prints a compact status line (or runs the user's previous status line command and prints its output). Installed from prefs with one button, after showing exactly what changes in `~/.claude/settings.json`; uninstall restores the previous `statusLine`. Documented, within the terms. |
| Direct mode | Opt-in switch in prefs behind a warning dialog. Read-only token use, polls every 5 min (min 2 min), 429/401 back-off, User-Agent `QuotaBuddy/<version>`. Falls back to the bridge when the token has expired. |
| Freshest wins | Both sources produce the same window model (`lib/limits.js`); the newer reading per window wins. Each window keeps `updatedAt`; the UI shows "updated 20 min ago" once data is older than 10 min. |
| Log scanning | **Out of process**: `src/worker/scanLogs.js` (`gjs -m`, `Gio.Subprocess`), never in the shell (a week of logs is ~1 s of parsing even in Python). Incremental: byte offsets per file in `~/.cache/quotabuddy/scan-state.json`; first run reads the last 35 days. One scan at a time; runs after a bridge update or every 2 min while the shell is idle. |
| Own history | Hourly buckets (14 days) and daily buckets (400 days) per model and project in `~/.local/share/quotabuddy/history.json`, so history outlives Claude Code's 30-day log cleanup. |
| Analysis | Pure, unit-tested: `lib/pace.js` (expected % at an even pace, burn rate from recent readings, "limit reached in ~1h40m" / "on track"), `lib/history.js` (rollups, top projects, cache hit ratio), `lib/pricing.js` (cost at API list prices per model; table in code, dated). |
| Top bar | PanelMenu.Button holding a **pill** (as in TrayBuddy): one ring (Cairo `St.DrawingArea`) + % per chosen figure. Default: session and week, **showing what's left**, ring style. Styles: rings + %, bars + %, rings only, text only. Pill background none/subtle/accent. Colours calm → amber (≥ 75 % used) → red (≥ 90 %), and amber early when the pace forecast says the limit is hit before reset. |
| Dropdown | Header (plan badge, freshness, source), two large rings with pace marker and reset countdown, Fable window when known, pace forecast lines, activity charts (24 h by hour, 7 days by day, stacked by model), cost cards (today/week/month at API prices, plan value), top projects + sessions + cache efficiency, footer (Refresh, Settings). Each section can be turned off. |
| Providers | `providers/claude.js` (shell only) exposes `{id, name, windows(), plan()}`; UI never talks to a source directly. Codex/Gemini later. |
| Privacy | No telemetry. Direct mode only talks to `api.anthropic.com`. Debug info: versions, settings, which sources have data and how old; never tokens, project names or paths. |

## Settings (`org.gnome.shell.extensions.quotabuddy`)
| Key | Type | Default |
|---|---|---|
| `panel-figures` | `as` | `['session', 'week']` (also `model-week`, `reset`, `tokens-today`, `cost-today`) |
| `panel-style` | enum rings-percent/bars-percent/rings/text | rings-percent |
| `show-left` | `b` | true |
| `pill-style` | enum none/subtle/accent | subtle |
| `popup-sections` | `as` | `['pace', 'activity', 'cost', 'projects']` |
| `activity-range` | enum day/week | day |
| `direct-mode` | `b` | false |
| `direct-accepted` | `b` | false (set when the warning was accepted) |
| `direct-interval` | `u` 120–1800 s | 300 |
| `plan-override` | `s` | `''` (automatic) |
| `claude-config-dir` | `s` | `''` (= `~/.claude`) |

## Steps
1. ✅ Research data sources, name, design decisions (this file)
2. ✅ Scaffold repo (LightsBuddy/TrayBuddy conventions)
3. ✅ Pure modules + tests: limits, pace, logParser, history, pricing, plan, format, settingsBackup, debugInfo, statusLineSetup
4. ✅ Status-line bridge, log-scan worker (verified against an independent count: identical replies and tokens)
5. ✅ Shell: gauge, chart, pill indicator, dropdown, Claude provider (file monitors, worker scheduling, direct client)
6. ✅ Prefs: Display, Data (bridge install, direct mode + warning), About
7. ⏳ Real-desktop test after re-login, dropdown screenshots, GitHub repo

## Later
- More providers (Codex CLI logs include rate-limit data; Gemini CLI).
- Combined history across devices via a synced folder (each device writes a summary; merge on read).
- Notifications at thresholds (e.g. 80 % / 95 % of the session).
- Keyboard shortcut to open the dropdown.
