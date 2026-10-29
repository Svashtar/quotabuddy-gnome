// SPDX-License-Identifier: GPL-2.0-or-later
// SPDX-FileCopyrightText: 2026 Mitja Cebokli
// Generated with AI for personal use.
// Do NOT upload to extensions.gnome.org (EGO) unless you understand JavaScript
// and can maintain this code.

// What Claude Code use would cost at Anthropic's API list prices. Only an
// estimate for comparison: subscriptions are not billed per token. Pure so it
// can be unit tested.

export const PRICES_AS_OF = '2026-10-06';

// USD per million tokens: [input, output, cache read]. Cache writes are 1.25×
// input for the 5-minute TTL and 2× for the 1-hour TTL on every model.
const MODELS = [
    ['claude-fable-5-1', 10, 50, 0.25],
    ['claude-mythos-5-1', 10, 50, 0.25],
    ['claude-fable-5', 10, 50, 1],
    ['claude-mythos-5', 10, 50, 1],
    ['claude-opus-5-5', 4, 20, 0.20],
    ['claude-opus-5', 5, 25, 0.50],
    ['claude-opus-4-8', 5, 25, 0.50],
    ['claude-opus-4-7', 5, 25, 0.50],
    ['claude-opus-4-6', 5, 25, 0.50],
    ['claude-sonnet-5-5', 2, 10, 0.20],
    ['claude-sonnet-5', 2, 10, 0.20],
    ['claude-sonnet-4-6', 3, 15, 0.30],
    ['claude-haiku-5-5', 0.10, 0.50, 0.01],
    ['claude-haiku-4-5', 1, 5, 0.10],
];

// Unknown versions fall back to their family's current price.
const FAMILIES = [
    ['fable', 10, 50, 0.25],
    ['mythos', 10, 50, 0.25],
    ['opus', 4, 20, 0.20],
    ['sonnet', 2, 10, 0.20],
    ['haiku', 0.10, 0.50, 0.01],
];

// "claude-opus-5-5-20260401" or "us.anthropic.claude-opus-5-5" → the table row
export function priceFor(model) {
    const id = (model ?? '').toLowerCase();
    const exact = MODELS.find(([name]) => id.includes(name));
    const row = exact ?? FAMILIES.find(([family]) => id.includes(family));
    if (!row)
        return null;
    const [, input, output, cacheRead] = row;
    return {input, output, cacheRead, cacheWrite5m: input * 1.25, cacheWrite1h: input * 2};
}

// usage: {input, output, cacheRead, cacheWrite5m, cacheWrite1h} token counts
export function costUsd(model, usage) {
    const p = priceFor(model);
    if (!p)
        return 0;
    return (usage.input * p.input +
            usage.output * p.output +
            usage.cacheRead * p.cacheRead +
            usage.cacheWrite5m * p.cacheWrite5m +
            usage.cacheWrite1h * p.cacheWrite1h) / 1e6;
}

// "claude-opus-5-5" → "Opus 5.5"; "claude-haiku-4-5-20251001" → "Haiku 4.5"
export function modelLabel(model) {
    const m = (model ?? '').toLowerCase().match(/(fable|mythos|opus|sonnet|haiku)-(\d+)(?:-(\d{1,2}))?(?!\d)/);
    if (!m)
        return model || 'Unknown';
    const family = m[1][0].toUpperCase() + m[1].slice(1);
    return m[3] ? `${family} ${m[2]}.${m[3]}` : `${family} ${m[2]}`;
}

// "Opus 5.5" → "opus": used to colour models consistently in charts.
export function modelFamily(model) {
    return (model ?? '').toLowerCase().match(/fable|mythos|opus|sonnet|haiku/)?.[0] ?? 'other';
}
