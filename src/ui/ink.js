// SPDX-License-Identifier: GPL-2.0-or-later
// SPDX-FileCopyrightText: 2026 Mitja Cebokli
// Generated with AI for personal use.
// Do NOT upload to extensions.gnome.org (EGO) unless you understand JavaScript
// and can maintain this code.

// Neutral colours follow the shell theme instead of being fixed white, so
// the dropdown and pill read on light and dark themes alike. St CSS has no
// currentColor, so secondary text keeps the theme's own colour and is faded
// with opacity, and drawings take the colour of the text around them.

// Opacity (0–255) for text classes that are secondary, by class.
const FADED = {
    'quotabuddy-dim': 153,
    'quotabuddy-section-title': 153,
    'quotabuddy-idle-text': 140,
};

// Fades an actor if its style classes mark it as secondary text. Coloured
// text (the amber "stale" age) keeps full strength.
export function fade(actor) {
    const classes = (actor.style_class ?? '').split(/\s+/);
    if (classes.includes('quotabuddy-stale'))
        return actor;
    const values = classes.map(c => FADED[c]).filter(v => v !== undefined);
    if (values.length)
        actor.opacity = Math.min(...values);
    return actor;
}

// The theme's text colour around an actor, as [r, g, b, a] in 0–1: the
// colour of its parent, since the actor's own `color` may be a status colour.
export function inkAround(actor) {
    const node = (actor.get_parent() ?? actor).get_theme_node();
    const c = node.get_foreground_color();
    return [c.red / 255, c.green / 255, c.blue / 255, c.alpha / 255];
}
