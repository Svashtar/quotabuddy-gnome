# Troubleshooting

## The pill shows dashes

QuotaBuddy has no reading of your limits yet.

1. Check **Settings → Data → Status-Line Bridge** says *Installed*.
2. Send a message in Claude Code and wait for the reply. Claude Code only reports limits after the first reply of a session.
3. Limits are only reported for Claude Pro and Max plans signed in to Claude Code, not for API keys.
4. If *Last Reading* still says *None yet*, check that Claude Code shows a status line at all. If you start Claude Code with a different `CLAUDE_CONFIG_DIR`, set the same folder in **Settings → Data → Claude Code Folder** and install the bridge again.

## The figures are old

The bridge only receives a reading when Claude Code replies in a terminal on this computer; the Claude desktop app doesn't run the status line. The dropdown shows the age of the newest reading. Use on other devices or on claude.ai shows up with the next reply here, or straight away with direct mode.

## The ring is grey after a reset

When a limit's reset time passes, QuotaBuddy shows it as fresh (0 % used) in grey until the next reading confirms the new figures.

The session can also show *Reset, waiting for a reading* with no reset time. Claude Code leaves the 5-hour session out of the status line once it resets, and only sends it again after your next reply.

## The plan badge is wrong or missing

The plan comes from Claude Code's sign-in. Choose the right one in **Settings → Data → Plan**.

## Activity or cost is empty

These come from Claude Code's logs in `~/.claude/projects`. QuotaBuddy reads them every 2 minutes and shortly after each reply. The first read goes back 35 days and can take a few seconds. Only Claude Code on this computer is counted, not claude.ai.

## Direct mode says the sign-in expired

Claude Code renews its sign-in when you use it. QuotaBuddy never renews it, so direct mode waits until Claude Code has done so. Start Claude Code once.

## Direct mode is rate-limited

Anthropic limits how often usage may be asked. QuotaBuddy waits longer after each refusal (up to 30 minutes). Set a longer interval in **Settings → Data → Check Every**.

## Collecting logs

Shell side (the pill, the dropdown, the log scan):

```sh
journalctl -f -o cat /usr/bin/gnome-shell
```

Preferences window:

```sh
journalctl -f -o cat /usr/bin/gjs
```

Messages from this extension start with `QuotaBuddy:`. Remove anything private before posting logs; QuotaBuddy never logs your sign-in.
