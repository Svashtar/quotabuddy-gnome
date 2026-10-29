// SPDX-License-Identifier: GPL-2.0-or-later
// SPDX-FileCopyrightText: 2026 Mitja Cebokli
// Generated with AI for personal use.
// Do NOT upload to extensions.gnome.org (EGO) unless you understand JavaScript
// and can maintain this code.

// Usage-limit windows from every source, in one shape. Pure so it can be
// unit tested.
//
// window: {id, kind: 'session'|'week'|'model-week', label, model, usedPct,
//          resetsAt (ms or null), durationMs, updatedAt (ms), source}

const HOUR = 3600 * 1000;
export const SESSION_MS = 5 * HOUR;
export const WEEK_MS = 7 * 24 * HOUR;

export const WARNING_PCT = 75;
export const CRITICAL_PCT = 90;

function clampPct(value) {
    const n = Number(value);
    return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : null;
}

// Epoch seconds, epoch milliseconds or an ISO string → ms
function toMs(value) {
    if (value === null || value === undefined || value === '')
        return null;
    if (typeof value === 'number')
        return value < 1e12 ? value * 1000 : value;
    const t = Date.parse(value);
    return Number.isNaN(t) ? null : t;
}

function slug(text) {
    return (text ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function makeWindow(kind, {usedPct, resetsAt, updatedAt, source, model = null}) {
    const pct = clampPct(usedPct);
    if (pct === null)
        return null;
    return {
        id: kind === 'model-week' ? `week:${slug(model)}` : kind,
        kind,
        model,
        usedPct: pct,
        resetsAt: toMs(resetsAt),
        durationMs: kind === 'session' ? SESSION_MS : WEEK_MS,
        updatedAt,
        source,
    };
}

// The bridge file the status-line script writes:
// {updatedAt (ms), rateLimits: {five_hour: {used_percentage, resets_at}, seven_day: {…}}}
export function fromStatusLine(record) {
    const limits = record?.rateLimits ?? {};
    const common = {updatedAt: record?.updatedAt ?? 0, source: 'statusline'};
    return [
        limits.five_hour && makeWindow('session', {...common, usedPct: limits.five_hour.used_percentage, resetsAt: limits.five_hour.resets_at}),
        limits.seven_day && makeWindow('week', {...common, usedPct: limits.seven_day.used_percentage, resetsAt: limits.seven_day.resets_at}),
    ].filter(Boolean);
}

// The direct-mode response. Newer responses carry a self-describing
// `limits[]`; older ones flat `five_hour` / `seven_day` / `seven_day_<model>`
// objects with `utilization`. Both are read, limits[] first.
export function fromDirect(json, updatedAt) {
    const common = {updatedAt, source: 'direct'};
    const windows = [];
    if (Array.isArray(json?.limits)) {
        for (const l of json.limits) {
            const model = l?.scope?.model?.display_name ?? null;
            const kind = l?.kind === 'session' ? 'session'
                : l?.kind === 'weekly_all' ? 'week'
                    : l?.kind === 'weekly_scoped' && model ? 'model-week' : null;
            if (kind)
                windows.push(makeWindow(kind, {...common, usedPct: l.percent, resetsAt: l.resets_at, model}));
        }
    }
    if (!windows.length && json && typeof json === 'object') {
        for (const [key, value] of Object.entries(json)) {
            if (!value || typeof value !== 'object' || !('utilization' in value))
                continue;
            if (key === 'five_hour') {
                windows.push(makeWindow('session', {...common, usedPct: value.utilization, resetsAt: value.resets_at}));
            } else if (key === 'seven_day') {
                windows.push(makeWindow('week', {...common, usedPct: value.utilization, resetsAt: value.resets_at}));
            } else if (key.startsWith('seven_day_')) {
                const name = key.slice('seven_day_'.length);
                const model = name[0].toUpperCase() + name.slice(1);
                windows.push(makeWindow('model-week', {...common, usedPct: value.utilization, resetsAt: value.resets_at, model}));
            }
        }
    }
    return windows.filter(Boolean);
}

// Extra usage (pay-as-you-go on top of the plan), when direct mode reports it.
export function spendFromDirect(json) {
    const s = json?.spend;
    if (s?.used && s?.limit) {
        const money = m => m.amount_minor / 10 ** (m.exponent ?? 2);
        return {usedAmount: money(s.used), limitAmount: money(s.limit), currency: s.used.currency ?? 'USD', usedPct: clampPct(s.percent)};
    }
    const e = json?.extra_usage;
    if (e?.is_enabled && e.monthly_limit) {
        const scale = 10 ** (e.decimal_places ?? 2);
        return {usedAmount: e.used_credits / scale, limitAmount: e.monthly_limit / scale, currency: e.currency ?? 'USD', usedPct: clampPct(e.utilization)};
    }
    return null;
}

// Newest reading per window wins. A window whose reset time has passed is
// fresh again: shown as 0 % used until the next reading says otherwise.
export function mergeWindows(lists, now) {
    const best = new Map();
    for (const w of lists.flat()) {
        const current = best.get(w.id);
        if (!current || w.updatedAt > current.updatedAt)
            best.set(w.id, w);
    }
    const order = {'session': 0, 'week': 1, 'model-week': 2};
    return [...best.values()]
        .map(w => (w.resetsAt !== null && w.resetsAt <= now ? {...w, usedPct: 0, resetsAt: null, expired: true} : w))
        .sort((a, b) => order[a.kind] - order[b.kind] || (a.model ?? '').localeCompare(b.model ?? ''));
}

export function severity(usedPct) {
    if (usedPct >= CRITICAL_PCT)
        return 'critical';
    if (usedPct >= WARNING_PCT)
        return 'warning';
    return 'normal';
}

// "2h 14m", "3d 4h", "45m", "now"
export function formatDuration(ms) {
    if (ms <= 0)
        return 'now';
    const minutes = Math.round(ms / 60000);
    if (minutes < 60)
        return `${Math.max(1, minutes)}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24)
        return minutes % 60 ? `${hours}h ${minutes % 60}m` : `${hours}h`;
    const days = Math.floor(hours / 24);
    return hours % 24 ? `${days}d ${hours % 24}h` : `${days}d`;
}
