# Getting started

## 1. Choose where your limits come from

Open QuotaBuddy's settings (right-click the pill → **Settings**, or click it → **Settings**) and go to **Data**. There are two ways; you can use both.

### Direct mode (recommended)

Asks Anthropic for your whole account every 5 minutes by default: the session, the week and model limits such as Fable, including use in the Claude desktop app, on other devices and on claude.ai.

It uses Claude Code's saved sign-in with an undocumented service, and Anthropic's Consumer Terms only allow that sign-in in Claude Code and claude.ai. Read [Privacy → Direct mode](privacy.md#direct-mode) before turning it on; the settings show the same warning.

1. Turn on **Direct Mode**.
2. Read the dialog and click **Turn On**.

The rings fill in within a few seconds.

### Claude Code status line (no network)

Claude Code can run a command after each reply to draw its status line, and passes it your session and weekly limits. QuotaBuddy's bridge is such a command: it saves the limits for the extension and prints a status line. This uses no network, but it is less complete:

- Readings only arrive with replies in Claude Code **in a terminal**. The desktop app doesn't run the status line, so with mostly desktop use the figures can be hours old. The dropdown says so when they are.
- After the session resets, Claude Code leaves it out until your next reply, so it shows as *Reset, waiting for a reading*.
- There are no model limits such as Fable.

1. Click **Install…** next to *Status-Line Bridge*. The dialog shows the `statusLine` setting in `~/.claude/settings.json` before and after.
2. Click **Install**, then send a message in Claude Code in a terminal.

If you already had a status line, the bridge runs it and shows its output, so it looks the same as before. QuotaBuddy keeps a copy of your `settings.json` as `settings.json.quotabuddy-backup` the first time it changes it. **Remove** puts your previous status line back. Without a previous status line, the bridge prints a short one, for example `Opus 5.5 · 5h 38 % · week 61 %`.

## The top bar

Each figure is a small ring (or bar) and a number. By default you see the **session** and the **week**, as the share that is **left**.

| Colour | Meaning |
|---|---|
| Green | Fine |
| Amber | 75 % used, or the pace says you will reach the limit before it resets |
| Red | 90 % used |
| Grey | No current reading (for example right after a reset) |

A model's own weekly limit, such as Fable's, uses that model's colour from the activity chart instead of green, so it stands apart from the session and week. It still turns amber or red.

On **Display** you can add the time to the session reset, a model's own weekly limit, tokens today or cost today; switch to bars, rings only or text; show what is used instead; and change the pill background.

## The dropdown

- **Header:** your plan and how old the newest reading is. Readings older than 10 minutes are shown in amber; without direct mode, a line under the rings also says how old they are.
- **Rings:** what is left (or used) of each limit, when it resets, and a small tick where an even pace would be by now (the Pace section says so too). A ring ahead of the tick means you are using it faster than the time passes.
- **Pace:** whether you are on track, and if not, when you would reach the limit at your current rate. For the session, the rate comes from the last hour; for the week, from the average since it started.
- **Activity:** the last 24 hours by hour or the last 7 days by day, stacked by model family. Bars are weighted by API price, which follows how much of your limit a reply uses more closely than raw tokens.
- **At API prices:** today, the last 7 days and this month, and how this month compares with your plan's price.
- **Projects this week:** where your use went, the busiest session today and how much of your prompts came from the cache.

Turn sections on or off on **Display → Dropdown**.
