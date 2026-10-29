// SPDX-License-Identifier: GPL-2.0-or-later
// SPDX-FileCopyrightText: 2026 Mitja Cebokli
// Generated with AI for personal use.
// Do NOT upload to extensions.gnome.org (EGO) unless you understand JavaScript
// and can maintain this code.

// Changes to Claude Code's settings.json for the status-line bridge. Only the
// `statusLine` key is touched. A status line the user already had is kept in
// QuotaBuddy's own file and run by the bridge, so it keeps showing. Pure so it
// can be unit tested.

export const BRIDGE_MARKER = 'quotabuddy@svashta.com/bridge/statusline.js';

export function bridgeCommand(extensionPath) {
    return `gjs -m '${extensionPath.replace(/'/g, "'\\''")}/bridge/statusline.js'`;
}

export function isInstalled(settings) {
    return typeof settings?.statusLine?.command === 'string' &&
        settings.statusLine.command.includes(BRIDGE_MARKER);
}

// → {settings, previous}: previous is the replaced statusLine or null
export function install(settings, command) {
    const next = {...settings};
    const previous = isInstalled(settings) ? null : settings?.statusLine ?? null;
    next.statusLine = {type: 'command', command, padding: settings?.statusLine?.padding ?? 0};
    return {settings: next, previous};
}

// Restores the status line from before, or removes the key.
export function uninstall(settings, previous) {
    if (!isInstalled(settings))
        return settings;
    const next = {...settings};
    if (previous)
        next.statusLine = previous;
    else
        delete next.statusLine;
    return next;
}

// The compact line the bridge prints when there is no previous status line:
// "Opus 5.5 · 5h 38 % · week 61 %"
export function compactLine(input) {
    const parts = [];
    if (input?.model?.display_name)
        parts.push(input.model.display_name);
    const r = input?.rate_limits;
    if (r?.five_hour?.used_percentage !== undefined)
        parts.push(`5h ${Math.round(r.five_hour.used_percentage)} %`);
    if (r?.seven_day?.used_percentage !== undefined)
        parts.push(`week ${Math.round(r.seven_day.used_percentage)} %`);
    return parts.join(' · ');
}

// What the bridge stores for the extension: only limits and non-identifying
// facts, never prompts, paths or the transcript location.
export function bridgeRecord(input, now) {
    const r = input?.rate_limits;
    if (!r?.five_hour && !r?.seven_day)
        return null;
    const pick = w => (w ? {used_percentage: w.used_percentage, resets_at: w.resets_at} : undefined);
    return {
        updatedAt: now,
        model: input.model?.id ?? null,
        rateLimits: {five_hour: pick(r.five_hour), seven_day: pick(r.seven_day)},
    };
}
