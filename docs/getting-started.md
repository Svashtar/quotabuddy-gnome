# Getting started

## 1. Install the status-line bridge

Claude Code can run a command after each reply to draw its status line, and passes it the session's details, including your usage limits. QuotaBuddy's bridge is such a command: it saves the limits for the extension and prints a status line.

1. Open QuotaBuddy's settings (click the pill → **Settings**) and go to **Data**.
2. Click **Install…** next to *Status-Line Bridge*. The dialog shows the `statusLine` setting in `~/.claude/settings.json` before and after.
3. Click **Install**.

If you already had a status line, the bridge runs it and shows its output, so it looks the same as before. QuotaBuddy keeps a copy of your `settings.json` as `settings.json.quotabuddy-backup` the first time it changes it. **Remove** puts your previous status line back.

Without a previous status line, the bridge prints a short one, for example `Opus 5.5 · 5h 38 % · week 61 %`.

## 2. Use Claude Code

After Claude Code's next reply, the rings fill in. Readings arrive with every reply after that.

## The top bar

Each figure is a small ring (or bar) and a number. By default you see the **session** and the **week**, as the share that is **left**.

| Colour | Meaning |
|---|---|
| Green | Fine |
| Amber | 75 % used, or the pace says you will reach the limit before it resets |
| Red | 90 % used |
| Grey | No current reading (for example right after a reset) |

On **Display** you can add the time to the session reset, a model's own weekly limit, tokens today or cost today; switch to bars, rings only or text; show what is used instead; and change the pill background.

## The dropdown

- **Header:** your plan and how old the newest reading is. Readings older than 10 minutes are shown in amber.
- **Rings:** what is left (or used) of each limit, when it resets, and a small tick where an even pace would be by now. A ring ahead of the tick means you are using it faster than the time passes.
- **Pace:** whether you are on track, and if not, when you would reach the limit at your current rate. For the session, the rate comes from the last hour; for the week, from the average since it started.
- **Activity:** the last 24 hours by hour or the last 7 days by day, stacked by model family. Bars are weighted by API price, which follows how much of your limit a reply uses more closely than raw tokens.
- **At API prices:** today, the last 7 days and this month, and how this month compares with your plan's price.
- **Projects this week:** where your use went, the busiest session today and how much of your prompts came from the cache.

Turn sections on or off on **Display → Dropdown**.

## Direct mode

The status line only reports the session and the week, and only when Claude Code replies on this computer. Direct mode asks Anthropic instead, every 5 minutes by default, so you also see use from other devices and model limits such as Fable.

It uses Claude Code's saved sign-in with an undocumented service. Read [Privacy → Direct mode](privacy.md#direct-mode) before turning it on; the settings show the same warning.
