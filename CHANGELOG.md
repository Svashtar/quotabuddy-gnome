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
- Direct mode for current, account-wide figures, recommended in the settings; off until you turn it on and accept what it means.
- About page with release notes, debug info for bug reports and settings backup.
- Right-click the top-bar button for quick actions: refresh now, show what is left or used, set up usage limits, open usage on claude.ai, settings. The Menu key or Shift+F10 opens it from the keyboard.
- Until there are usage limits to show, the top bar shows the QuotaBuddy icon rather than empty rings.
- Without direct mode, the dropdown says when the figures are out of date and why.
- The dropdown scrolls when it is taller than the screen.
- A model's own weekly limit (such as Fable) shows in that model's colour in the top bar and the dropdown, so it is told apart from the session and week.
- The Pace section explains the tick on the large rings, which is drawn in the theme's text colour so it doesn't look like part of the limit, and shows on both sides of the ring.
- Light themes: secondary text, tracks and backgrounds follow the shell theme instead of being fixed white, so the dropdown reads on light and dark themes.
- Both menus line up with the right edge of the top-bar button, so the open dropdown no longer shifts when the numbers change width.
