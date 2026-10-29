// SPDX-License-Identifier: GPL-2.0-or-later
// SPDX-FileCopyrightText: 2026 Mitja Cebokli
// Generated with AI for personal use.
// Do NOT upload to extensions.gnome.org (EGO) unless you understand JavaScript
// and can maintain this code.

// Plain-text report for bug reports. Says which sources have data and how
// old it is; never tokens, project names, paths or usage figures.

import {formatDuration} from './limits.js';

// info: {extensionVersion, commit?, shellVersion, gjsVersion, os, sessionType, now,
//        settings: {panelFigures, panelStyle, showLeft, pillStyle, popupSections, directMode, directInterval, planOverride},
//        plan, bridgeInstalled, sources: {statusline, direct, logs} (last update ms or 0),
//        directError, windows: [id], historyDays}
export function formatDebugInfo(info) {
    const s = info.settings;
    const age = ms => (ms ? `${formatDuration(info.now - ms)} ago` : 'never');
    return [
        `QuotaBuddy: ${info.extensionVersion}${info.commit ? ` (${info.commit})` : ''}`,
        `GNOME Shell: ${info.shellVersion}`,
        `GJS: ${info.gjsVersion}`,
        `OS: ${info.os}`,
        `Session: ${info.sessionType}`,
        `Plan: ${info.plan ?? 'unknown'}${s.planOverride ? ' (set by hand)' : ''}`,
        `Top bar: ${s.panelFigures.join(', ') || 'nothing'}; ${s.panelStyle}; ${s.showLeft ? 'left' : 'used'}; background ${s.pillStyle}`,
        `Dropdown: ${s.popupSections.join(', ') || 'limits only'}`,
        `Status-line bridge: ${info.bridgeInstalled ? 'installed' : 'not installed'}, last reading ${age(info.sources.statusline)}`,
        `Direct mode: ${s.directMode ? `on, every ${s.directInterval} s, last reading ${age(info.sources.direct)}` : 'off'}` +
            (info.directError ? ` (last error: ${info.directError})` : ''),
        `Log scan: last ${age(info.sources.logs)}, ${info.historyDays} days of history`,
        `Windows: ${info.windows.join(', ') || 'none'}`,
    ].join('\n');
}

// "18801" → "1.88.1"
export function formatGjsVersion(version) {
    const v = Number(version);
    return `${Math.floor(v / 10000)}.${Math.floor(v / 100) % 100}.${v % 100}`;
}
