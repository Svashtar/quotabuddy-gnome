// SPDX-License-Identifier: GPL-2.0-or-later
// SPDX-FileCopyrightText: 2026 Mitja Cebokli
// Generated with AI for personal use.
// Do NOT upload to extensions.gnome.org (EGO) unless you understand JavaScript
// and can maintain this code.

// The plan name from Claude Code's credentials file. Only the two non-secret
// fields are passed in here; the token never reaches this module. Pure.

export const PLANS = {
    'pro': {label: 'Pro', monthlyUsd: 20},
    'max-5x': {label: 'Max 5×', monthlyUsd: 100},
    'max-20x': {label: 'Max 20×', monthlyUsd: 200},
    'team': {label: 'Team', monthlyUsd: null},
    'enterprise': {label: 'Enterprise', monthlyUsd: null},
};

// subscriptionType "max", rateLimitTier "default_claude_max_5x" → "max-5x"
export function planId(subscriptionType, rateLimitTier) {
    const type = (subscriptionType ?? '').toLowerCase();
    const tier = (rateLimitTier ?? '').toLowerCase();
    if (type === 'max' || tier.includes('max')) {
        const m = tier.match(/(\d+)x/);
        return m && m[1] === '20' ? 'max-20x' : 'max-5x';
    }
    if (type in PLANS)
        return type;
    return null;
}

export function planInfo(id) {
    return PLANS[id] ?? null;
}
