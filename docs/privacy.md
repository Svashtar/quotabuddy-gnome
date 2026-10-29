# Privacy

QuotaBuddy has no telemetry. By default it makes **no network connections**.

## What it reads

| What | Why |
|---|---|
| The status line data Claude Code passes to the bridge | Your session and weekly limits and their reset times. The bridge saves only those, the model name and the time; never your prompts, paths or the transcript location. |
| `~/.claude/projects/**/*.jsonl` (Claude Code's logs) | Token counts, model, time, project folder and session of each reply. Message text is skipped. |
| `~/.claude/.credentials.json` | Only `subscriptionType` and `rateLimitTier`, for the plan name. The sign-in token in the same file is only read when direct mode is on. |
| `~/.claude/settings.json` | To see whether the bridge is installed. |

## What it writes

| File | Contents |
|---|---|
| `~/.cache/quotabuddy/claude-status.json` | The latest limits from the bridge |
| `~/.cache/quotabuddy/scan-state.json` | How far each log file has been read, and recent reply ids so none is counted twice |
| `~/.cache/quotabuddy/samples.json` | Recent readings of each limit, for the pace forecast |
| `~/.local/share/quotabuddy/history.json` | Tokens and cost per hour (14 days), per day (400 days) and per session (35 days), by model and project folder |
| `~/.config/quotabuddy/previous-statusline.json` | Your previous status line, while the bridge is installed |
| `~/.claude/settings.json` | Only the `statusLine` setting, when you install or remove the bridge, after you agree. A copy of the original is kept as `settings.json.quotabuddy-backup`. |

Settings live in GSettings under `org.gnome.shell.extensions.quotabuddy`. To delete QuotaBuddy's data, remove the three `quotabuddy` folders above.

## Direct mode

Off by default. When you turn it on, QuotaBuddy:

- reads the sign-in token Claude Code saved in `~/.claude/.credentials.json`,
- keeps it in memory only, and drops it when direct mode is turned off,
- sends it only to `https://api.anthropic.com/api/oauth/usage`, every 5 minutes by default (never more often than every 2 minutes), with the User-Agent `QuotaBuddy/<version>`,
- **never renews, changes or writes the token.** When it expires, QuotaBuddy waits for Claude Code to renew it.

This service is not documented by Anthropic and may change or stop working at any time. Anthropic's Consumer Terms allow the subscription sign-in only in Claude Code and claude.ai, so using it in another app may go against them. That is why it is off by default and needs your explicit agreement.

## Debug info

**Settings → About → Copy Debug Info** copies versions, your QuotaBuddy settings, the plan name, whether the bridge is installed and how old each source's data is. It never contains tokens, project names, paths or usage figures.
