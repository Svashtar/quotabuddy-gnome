# Changelog

All notable changes to QuotaBuddy are documented here.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow `version-name` in `metadata.json`.

## [Unreleased]

### Added
- First version in development: Claude's 5-hour session and weekly limits in the top bar as small rings with what is left (or used) in a pill.
- Choose the top-bar figures: session, week, a model's own weekly limit (such as Fable), time to the session reset, tokens today, cost today. Four styles: rings and percentages, bars and percentages, rings only, text only.
- Rings turn amber at 75 % used and red at 90 %, and amber early when the pace says the limit will be reached before it resets.
- Dropdown with large rings, an even-pace marker and reset countdowns, then pace forecasts, activity charts for the last 24 hours or 7 days by model, cost at API prices with the plan's value, and the busiest projects and sessions.
- Plan badge (Pro, Max 5×, Max 20×…) read from Claude Code's sign-in, or set by hand.
- Status-line bridge installed from the settings with one click, showing exactly what changes; a status line you already had keeps showing.
- Own usage history built from Claude Code's logs (in a separate process), kept beyond Claude Code's 30-day log cleanup.
- Optional direct mode for account-wide figures, off by default and explained before it turns on.
- About page with release notes, debug info for bug reports and settings backup.
