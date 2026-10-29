// SPDX-License-Identifier: GPL-2.0-or-later
// SPDX-FileCopyrightText: 2026 Mitja Cebokli
// Generated with AI for personal use.
// Do NOT upload to extensions.gnome.org (EGO) unless you understand JavaScript
// and can maintain this code.

// Numbers for the top bar and the dropdown. Pure so it can be unit tested.

// "1.2M", "350k", "999"
export function formatTokens(n) {
    if (n >= 1e9)
        return `${(n / 1e9).toFixed(n >= 1e10 ? 0 : 1)}B`;
    if (n >= 1e6)
        return `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M`;
    if (n >= 1e3)
        return `${Math.round(n / 1e3)}k`;
    return String(Math.round(n));
}

// "$0.42", "$39.70", "$1,204"
export function formatMoney(amount, currency = 'USD') {
    try {
        return new Intl.NumberFormat(undefined, {
            style: 'currency', currency,
            maximumFractionDigits: amount >= 100 ? 0 : 2,
            minimumFractionDigits: amount >= 100 ? 0 : 2,
        }).format(amount);
    } catch {
        return `${currency} ${amount.toFixed(2)}`;
    }
}

// The number shown for a window: what is left or what is used, 0–100.
export function shownPct(usedPct, showLeft) {
    return Math.round(showLeft ? 100 - usedPct : usedPct);
}

// "9:00", "Thu 14:00" for a reset time within a week
export function formatClock(ms, now) {
    const d = new Date(ms);
    const time = d.toLocaleTimeString(undefined, {hour: '2-digit', minute: '2-digit'});
    if (ms - now < 20 * 3600 * 1000)
        return time;
    return `${d.toLocaleDateString(undefined, {weekday: 'short'})} ${time}`;
}
