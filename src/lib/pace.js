// SPDX-License-Identifier: GPL-2.0-or-later
// SPDX-FileCopyrightText: 2026 Mitja Cebokli
// Generated with AI for personal use.
// Do NOT upload to extensions.gnome.org (EGO) unless you understand JavaScript
// and can maintain this code.

// Are you on track to stay inside a window? Pure so it can be unit tested.

const HOUR = 3600 * 1000;
const RECENT_MS = HOUR;
const MIN_SPAN_MS = 10 * 60 * 1000;
const MAX_SAMPLES = 300;

// Where an even pace would be by now, 0–100. Null when the window's start is unknown.
export function expectedPct(window, now) {
    if (window.resetsAt === null)
        return null;
    const start = window.resetsAt - window.durationMs;
    return Math.min(100, Math.max(0, (now - start) / window.durationMs * 100));
}

// Readings of one window over time, for a burn rate. A new reset time means a
// new window, so older readings are dropped.
// samples: [{t, pct, resetsAt}]
export function addSample(samples, window) {
    const list = samples.filter(s => s.resetsAt === window.resetsAt && s.t < window.updatedAt);
    list.push({t: window.updatedAt, pct: window.usedPct, resetsAt: window.resetsAt});
    return list.slice(-MAX_SAMPLES);
}

// Percentage points per hour. Sessions use the last hour when there are
// readings far enough apart (it reacts to bursts); otherwise, and for weeks,
// the average since the window started.
export function burnRate(window, samples, now) {
    if (window.kind === 'session') {
        const recent = samples.filter(s => s.resetsAt === window.resetsAt && s.t >= now - RECENT_MS);
        if (recent.length >= 2) {
            const first = recent[0], last = recent.at(-1);
            if (last.t - first.t >= MIN_SPAN_MS)
                return Math.max(0, (last.pct - first.pct) / ((last.t - first.t) / HOUR));
        }
    }
    if (window.resetsAt === null)
        return null;
    const elapsed = now - (window.resetsAt - window.durationMs);
    return elapsed > MIN_SPAN_MS ? window.usedPct / (elapsed / HOUR) : null;
}

// status: 'unknown' | 'idle' | 'on-track' | 'ahead' | 'will-hit'
// projectedPct: where it ends at this rate; hitAt: when 100 % is reached (ms) or null
export function forecast(window, samples, now) {
    const expected = expectedPct(window, now);
    const rate = burnRate(window, samples, now);
    if (window.resetsAt === null || rate === null)
        return {status: 'unknown', expectedPct: expected, ratePerHour: rate, projectedPct: null, hitAt: null};

    const hoursLeft = Math.max(0, (window.resetsAt - now) / HOUR);
    const projected = window.usedPct + rate * hoursLeft;
    let hitAt = null;
    if (window.usedPct >= 100)
        hitAt = now;
    else if (projected >= 100 && rate > 0)
        hitAt = now + (100 - window.usedPct) / rate * HOUR;

    let status;
    if (rate === 0)
        status = 'idle';
    else if (hitAt !== null)
        status = 'will-hit';
    else if (expected !== null && window.usedPct > expected + 5)
        status = 'ahead';
    else
        status = 'on-track';
    return {status, expectedPct: expected, ratePerHour: rate, projectedPct: Math.min(100, projected), hitAt};
}
