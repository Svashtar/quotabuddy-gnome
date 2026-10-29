// SPDX-License-Identifier: GPL-2.0-or-later
// SPDX-FileCopyrightText: 2026 Mitja Cebokli
// Generated with AI for personal use.
// Do NOT upload to extensions.gnome.org (EGO) unless you understand JavaScript
// and can maintain this code.

// The dropdown: limits as large rings, then the sections chosen in the
// settings (pace, activity, cost, projects). Rebuilt when it opens, when data
// arrives while open, and every 30 s for the countdowns.

import GLib from 'gi://GLib';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import Pango from 'gi://Pango';

import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import {gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';

import {severity, formatDuration} from '../lib/limits.js';
import {hourlySeries, dailySeries, summarySince, startOfDay, ranked, recentSessions, cacheHitRatio, projectName} from '../lib/history.js';
import {modelFamily, modelLabel, PRICES_AS_OF} from '../lib/pricing.js';
import {formatMoney, formatClock, shownPct} from '../lib/format.js';
import {Gauge} from './gauge.js';
import {StackedChart, FAMILY_COLORS, FAMILY_ORDER, familyColorCss} from './chart.js';

const DAY = 24 * 3600 * 1000;
const STALE_MS = 10 * 60 * 1000;
const TICK_S = 30;

const label = (text, style_class = '', params = {}) => new St.Label({text, style_class, ...params});
const vbox = (style_class = '', params = {}) => new St.BoxLayout({orientation: Clutter.Orientation.VERTICAL, style_class, ...params});
const hbox = (style_class = '', params = {}) => new St.BoxLayout({style_class, ...params});
// Wrapping instead of ending in "…": the scrolled dropdown gives labels their
// minimum height, which for an ellipsizing label is a single line.
function wrap(l) {
    l.clutter_text.line_wrap = true;
    l.clutter_text.ellipsize = Pango.EllipsizeMode.NONE;
    return l;
}
const spacer = () => new St.Widget({x_expand: true});

function colorCss(family) {
    const [r, g, b] = FAMILY_COLORS[family];
    return `background-color: rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)});`;
}

function windowName(w) {
    if (w.kind === 'session')
        return _('Session');
    if (w.kind === 'week')
        return _('Week');
    /* Translators: a weekly limit for one model, e.g. "Fable week" */
    return _('%s week').format(w.model);
}

export class Popup {
    constructor({menu, settings, provider, openPreferences}) {
        this._menu = menu;
        this._settings = settings;
        this._provider = provider;
        this._openPreferences = openPreferences;
        menu.actor.add_style_class_name('quotabuddy-menu');

        this._item = new PopupMenu.PopupBaseMenuItem({reactive: false, can_focus: false, style_class: 'quotabuddy-item'});
        this._content = vbox('quotabuddy-content', {x_expand: true});
        // Scrolls when the dropdown is taller than the screen (the indicator
        // caps the menu at the work area's height).
        const scroll = new St.ScrollView({
            style_class: 'quotabuddy-scroll',
            hscrollbar_policy: St.PolicyType.NEVER,
            vscrollbar_policy: St.PolicyType.AUTOMATIC,
            overlay_scrollbars: true,
            x_expand: true,
            y_expand: true,
        });
        scroll.set_child(this._content);
        this._item.add_child(scroll);
        menu.addMenuItem(this._item);

        menu.connectObject('open-state-changed', (_m, open) => {
            if (open) {
                this.update();
                this._tick = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, TICK_S, () => {
                    this.update();
                    return GLib.SOURCE_CONTINUE;
                });
            } else {
                this._stopTick();
            }
        }, this);
        settings.connectObject(
            'changed::popup-sections', () => this._menu.isOpen && this.update(),
            'changed::activity-range', () => this._menu.isOpen && this.update(),
            this);
    }

    destroy() {
        this._stopTick();
        this._menu.disconnectObject(this);
        this._settings.disconnectObject(this);
    }

    _stopTick() {
        if (this._tick)
            GLib.source_remove(this._tick);
        this._tick = null;
    }

    update() {
        this._content.destroy_all_children();
        const now = Date.now();
        const windows = this._provider.windows;
        const history = this._provider.history;
        const hasHistory = Object.keys(history.daily).length > 0;

        this._content.add_child(this._header(windows, now));
        if (!windows.length && !hasHistory) {
            this._content.add_child(this._empty());
            this._content.add_child(this._footer());
            return;
        }

        const main = windows.filter(w => w.kind !== 'model-week');
        if (main.length) {
            this._content.add_child(this._hero(main, now));
            const note = this._staleNote(main, now);
            if (note)
                this._content.add_child(note);
        } else {
            this._content.add_child(this._noLimits());
        }

        const models = windows.filter(w => w.kind === 'model-week');
        const spend = this._provider.spend;
        if (models.length || spend)
            this._content.add_child(this._modelLimits(models, spend, now));

        const sections = this._settings.get_strv('popup-sections');
        if (sections.includes('pace') && main.length)
            this._content.add_child(this._pace(main, now));
        if (sections.includes('activity') && hasHistory)
            this._content.add_child(this._activity(history, now));
        if (sections.includes('cost') && hasHistory)
            this._content.add_child(this._cost(history, now));
        if (sections.includes('projects') && hasHistory)
            this._content.add_child(this._projects(history, now));
        this._content.add_child(this._footer());
    }


    _header(windows, now) {
        const box = hbox('quotabuddy-header');
        box.add_child(label('Claude', 'quotabuddy-title', {y_align: Clutter.ActorAlign.CENTER}));
        const plan = this._provider.plan;
        if (plan)
            box.add_child(label(plan.label, 'quotabuddy-badge', {y_align: Clutter.ActorAlign.CENTER}));
        box.add_child(spacer());

        const newest = windows.reduce((best, w) => (w.updatedAt > (best?.updatedAt ?? 0) ? w : best), null);
        if (newest) {
            const age = now - newest.updatedAt;
            const source = newest.source === 'direct' ? _('direct') : _('status line');
            const text = age < 60 * 1000
                /* Translators: %s is "status line" or "direct" */
                ? _('Just updated · %s').format(source)
                /* Translators: first %s is a duration like "12m", second "status line" or "direct" */
                : _('%s ago · %s').format(formatDuration(age), source);
            box.add_child(label(text, `quotabuddy-dim${age > STALE_MS ? ' quotabuddy-stale' : ''}`, {y_align: Clutter.ActorAlign.CENTER}));
        }
        return box;
    }

    _empty() {
        const box = vbox('quotabuddy-empty');
        box.add_child(label(_('No usage data yet'), 'quotabuddy-empty-title'));
        const text = label(_('Turn on direct mode in the settings for your limits, or install the status-line bridge to use no network.'),
                           'quotabuddy-dim');
        wrap(text);
        box.add_child(text);
        return box;
    }

    // Status-line readings only arrive with replies in a terminal, so they can
    // be hours old and miss the session; say so instead of looking current.
    _staleNote(windows, now) {
        if (this._provider.status.directMode)
            return null;
        const newest = Math.max(...windows.map(w => w.updatedAt));
        if (now - newest <= STALE_MS)
            return null;
        /* Translators: %s is a duration like "2h 10m" */
        const text = label(_('These figures are from %s ago, the last reply in Claude Code in a terminal. Turn on direct mode for current ones.')
            .format(formatDuration(now - newest)), 'quotabuddy-dim quotabuddy-small');
        wrap(text);
        return text;
    }

    _noLimits() {
        const box = vbox('quotabuddy-section');
        const status = this._provider.status;
        let message;
        if (status.directMode)
            message = _('Limits appear after the next check with Anthropic.');
        else if (status.bridgeInstalled)
            message = _('Limits appear after the next reply in Claude Code in a terminal. Direct mode shows them straight away.');
        else
            message = _('Turn on direct mode in the settings to see your limits.');
        const text = label(message, 'quotabuddy-dim');
        wrap(text);
        box.add_child(text);
        return box;
    }


    _hero(windows, now) {
        const showLeft = this._settings.get_boolean('show-left');
        const box = hbox('quotabuddy-hero', {x_expand: true});
        for (const w of windows) {
            const fc = this._provider.forecast(w);
            const level = w.expired ? 'idle' : severity(w.usedPct) === 'normal' && fc.status === 'will-hit' ? 'warning' : severity(w.usedPct);
            const pct = shownPct(w.usedPct, showLeft);
            const card = vbox('quotabuddy-hero-card', {x_expand: true});

            const ringBox = new St.Widget({layout_manager: new Clutter.BinLayout(), x_align: Clutter.ActorAlign.CENTER});
            const gauge = new Gauge({shape: 'ring', thickness: 0.11, style_class: `quotabuddy-hero-ring quotabuddy-${level}`});
            // The marker shows where an even pace would be, on the same scale as the ring.
            const marker = fc.expectedPct === null ? null : (showLeft ? 100 - fc.expectedPct : fc.expectedPct) / 100;
            gauge.setValue(pct / 100, marker);
            ringBox.add_child(gauge);
            const centre = vbox('', {x_align: Clutter.ActorAlign.CENTER, y_align: Clutter.ActorAlign.CENTER});
            centre.add_child(label(`${pct}%`, `quotabuddy-hero-pct quotabuddy-${level}-text`, {x_align: Clutter.ActorAlign.CENTER}));
            centre.add_child(label(showLeft ? _('left') : _('used'), 'quotabuddy-dim quotabuddy-small', {x_align: Clutter.ActorAlign.CENTER}));
            ringBox.add_child(centre);
            card.add_child(ringBox);

            card.add_child(label(windowName(w), 'quotabuddy-hero-name', {x_align: Clutter.ActorAlign.CENTER}));
            // Two lines: half the dropdown is too narrow for both on one.
            const small = text => card.add_child(label(text, 'quotabuddy-dim quotabuddy-small', {x_align: Clutter.ActorAlign.CENTER}));
            if (w.expired) {
                small(_('Reset, waiting for a reading'));
            } else if (w.resetsAt) {
                /* Translators: "Resets in 2h 14m"; the clock time follows on the next line */
                small(_('Resets in %s').format(formatDuration(w.resetsAt - now)));
                small(formatClock(w.resetsAt, now));
            } else {
                small(_('Reset time unknown'));
            }
            box.add_child(card);
        }
        return box;
    }

    _modelLimits(models, spend, now) {
        const showLeft = this._settings.get_boolean('show-left');
        const box = vbox('quotabuddy-section');
        for (const w of models) {
            const pct = shownPct(w.usedPct, showLeft);
            const level = w.expired ? 'idle' : severity(w.usedPct);
            box.add_child(this._barRow(windowName(w), pct / 100, `${pct}%`, level,
                                       w.resetsAt ? _('resets %s').format(formatClock(w.resetsAt, now)) : null,
                                       level === 'normal' ? familyColorCss(modelFamily(w.model)) : null));
        }
        if (spend) {
            box.add_child(this._barRow(_('Extra usage'), spend.usedPct / 100,
                `${formatMoney(spend.usedAmount, spend.currency)} / ${formatMoney(spend.limitAmount, spend.currency)}`, severity(spend.usedPct), null));
        }
        return box;
    }

    // barStyle: inline CSS for the bar, e.g. a model family's colour
    _barRow(name, fraction, value, level, note, barStyle = null) {
        const row = vbox('quotabuddy-bar-row');
        const top = hbox();
        top.add_child(label(name, 'quotabuddy-row-name'));
        if (note)
            top.add_child(label(note, 'quotabuddy-dim quotabuddy-small quotabuddy-note', {y_align: Clutter.ActorAlign.CENTER}));
        top.add_child(spacer());
        top.add_child(label(value, `quotabuddy-row-value quotabuddy-${level}-text`));
        row.add_child(top);
        const bar = new Gauge({shape: 'bar', style_class: `quotabuddy-row-bar quotabuddy-${level}`, x_expand: true});
        if (barStyle)
            bar.style = barStyle;
        bar.setValue(fraction);
        row.add_child(bar);
        return row;
    }


    _pace(windows, now) {
        const box = this._section(_('Pace'));
        // Explains the ticks on the large rings, where the reader looks for pace.
        if (windows.some(w => !w.expired && this._provider.forecast(w).expectedPct !== null))
            box.add_child(wrap(label(_('The tick on each ring is where an even pace would be.'), 'quotabuddy-dim quotabuddy-small')));
        for (const w of windows) {
            const fc = this._provider.forecast(w);
            const used = Math.round(w.usedPct);
            const gone = fc.expectedPct === null ? null : Math.round(fc.expectedPct);
            let text, level = 'normal';
            switch (fc.status) {
            case 'will-hit':
                level = 'warning';
                text = fc.hitAt <= now
                    ? _('Limit reached')
                    /* Translators: "At this pace the limit is reached in 1h 40m, 2h before it resets" */
                    : _('At this pace the limit is reached in %s, %s before it resets')
                        .format(formatDuration(fc.hitAt - now), formatDuration(w.resetsAt - fc.hitAt));
                break;
            case 'ahead':
                level = 'warning';
                /* Translators: "Faster than an even pace: 50% used, 20% of the time gone" */
                text = _('Faster than an even pace: %d%% used, %d%% of the time gone').format(used, gone);
                break;
            case 'on-track':
                /* Translators: "On track to end near 64%" */
                text = _('On track to end near %d%%').format(Math.round(fc.projectedPct));
                break;
            case 'idle':
                text = _('No use lately');
                break;
            default:
                text = _('Not enough readings yet');
            }
            const row = hbox('quotabuddy-pace-row');
            row.add_child(new St.Widget({style_class: `quotabuddy-dot quotabuddy-dot-${level}`, y_align: Clutter.ActorAlign.CENTER}));
            const t = label(`${windowName(w)}: ${text}`, 'quotabuddy-pace-text', {x_expand: true});
            wrap(t);
            row.add_child(t);
            box.add_child(row);
        }
        return box;
    }


    _activity(history, now) {
        const range = this._settings.get_string('activity-range');
        const box = this._section(_('Activity'), this._rangeSwitch(range));

        const series = range === 'week' ? dailySeries(history, now, 7) : hourlySeries(history, now, 24);
        const families = {};
        const columns = series.map(slot => {
            const segments = {};
            for (const [model, t] of Object.entries(slot.models)) {
                const f = modelFamily(model);
                segments[f] = (segments[f] ?? 0) + t.cost;
                families[f] = (families[f] ?? 0) + t.cost;
            }
            return {segments};
        });
        const chart = new StackedChart({x_expand: true});
        chart.setData(columns, columns.length - 1);
        box.add_child(chart);

        const axis = hbox('quotabuddy-axis');
        if (range === 'week') {
            for (const slot of series) {
                const d = new Date(`${slot.day}T12:00:00`);
                axis.add_child(label(d.toLocaleDateString(undefined, {weekday: 'narrow'}), 'quotabuddy-dim quotabuddy-small',
                                     {x_expand: true, x_align: Clutter.ActorAlign.CENTER}));
            }
        } else {
            axis.add_child(label(_('24 h ago'), 'quotabuddy-dim quotabuddy-small'));
            axis.add_child(spacer());
            axis.add_child(label(_('12 h'), 'quotabuddy-dim quotabuddy-small'));
            axis.add_child(spacer());
            axis.add_child(label(_('now'), 'quotabuddy-dim quotabuddy-small'));
        }
        box.add_child(axis);

        const legend = hbox('quotabuddy-legend');
        const total = Object.values(families).reduce((s, v) => s + v, 0);
        for (const f of FAMILY_ORDER.filter(x => families[x])) {
            const item = hbox('quotabuddy-legend-item');
            item.add_child(new St.Widget({style_class: 'quotabuddy-swatch', style: colorCss(f), y_align: Clutter.ActorAlign.CENTER}));
            const name = f === 'other' ? _('Other') : f[0].toUpperCase() + f.slice(1);
            item.add_child(label(`${name} ${Math.round(families[f] / total * 100)}%`, 'quotabuddy-small'));
            legend.add_child(item);
        }
        if (!total)
            legend.add_child(label(_('No replies in this range'), 'quotabuddy-dim quotabuddy-small'));
        box.add_child(legend);
        return box;
    }

    _rangeSwitch(range) {
        const box = hbox('quotabuddy-switch');
        for (const [value, text] of [['day', _('24 h')], ['week', _('7 days')]]) {
            const button = new St.Button({
                label: text,
                style_class: `quotabuddy-switch-button${value === range ? ' quotabuddy-switch-active' : ''}`,
                can_focus: true,
            });
            button.connect('clicked', () => this._settings.set_string('activity-range', value));
            box.add_child(button);
        }
        return box;
    }


    _cost(history, now) {
        const box = this._section(_('At API prices'));
        const monthStart = new Date(now);
        monthStart.setDate(1);
        const periods = [
            [_('Today'), startOfDay(now)],
            [_('7 days'), startOfDay(now) - 6 * DAY],
            [_('This month'), startOfDay(monthStart.getTime())],
        ];
        const cards = hbox('quotabuddy-cards', {x_expand: true});
        let month = 0;
        for (const [name, from] of periods) {
            const cost = summarySince(history, from).total.cost;
            month = cost;
            const card = vbox('quotabuddy-card', {x_expand: true});
            card.add_child(label(formatMoney(cost), 'quotabuddy-card-value'));
            card.add_child(label(name, 'quotabuddy-dim quotabuddy-small'));
            cards.add_child(card);
        }
        box.add_child(cards);

        const plan = this._provider.plan;
        let note;
        if (plan?.monthlyUsd && month > 0)
            /* Translators: "This month's use is worth 4.1× the Max 5× price" */
            note = _('This month’s use is worth %s× the %s price').format((month / plan.monthlyUsd).toFixed(1), plan.label);
        else
            note = _('An estimate for comparison; your plan is not billed per token.');
        const t = label(`${note} ${_('Prices as of %s.').format(PRICES_AS_OF)}`, 'quotabuddy-dim quotabuddy-small');
        wrap(t);
        box.add_child(t);
        return box;
    }


    _projects(history, now) {
        const box = this._section(_('Projects this week'));
        const week = summarySince(history, startOfDay(now) - 6 * DAY);
        for (const p of ranked(week.projects, 4)) {
            box.add_child(this._barRow(projectName(p.key), p.share, formatMoney(p.totals.cost), 'project',
                `${Math.round(p.share * 100)}%`));
        }

        const busiest = recentSessions(history, startOfDay(now), 1)[0];
        if (busiest) {
            const models = Object.entries(busiest.models).sort((a, b) => b[1] - a[1]).map(([m]) => modelLabel(m));
            /* Translators: "Busiest session today: quotabuddy-gnome · 1h 20m · Opus 5.5 · $12.30" */
            const text = _('Busiest session today: %s · %s · %s · %s').format(projectName(busiest.project),
                                                                              formatDuration(busiest.end - busiest.start), models[0], formatMoney(busiest.cost));
            const t = label(text, 'quotabuddy-small quotabuddy-line');
            wrap(t);
            box.add_child(t);
        }
        const ratio = cacheHitRatio(week.total);
        if (ratio !== null) {
            /* Translators: "Cache: 94% of prompts read from cache" */
            box.add_child(label(_('Cache: %d%% of prompts read from cache').format(Math.round(ratio * 100)),
                                'quotabuddy-dim quotabuddy-small quotabuddy-line'));
        }
        return box;
    }


    _section(title, extra = null) {
        const box = vbox('quotabuddy-section');
        const head = hbox('quotabuddy-section-head');
        head.add_child(label(title, 'quotabuddy-section-title', {y_align: Clutter.ActorAlign.CENTER}));
        head.add_child(spacer());
        if (extra)
            head.add_child(extra);
        box.add_child(head);
        return box;
    }

    _footer() {
        const box = hbox('quotabuddy-footer');
        const button = (text, icon, handler) => {
            const b = new St.Button({style_class: 'quotabuddy-footer-button', can_focus: true, x_expand: true});
            const inner = hbox('', {x_align: Clutter.ActorAlign.CENTER});
            inner.add_child(new St.Icon({icon_name: icon, style_class: 'quotabuddy-footer-icon'}));
            inner.add_child(label(text, '', {y_align: Clutter.ActorAlign.CENTER}));
            b.set_child(inner);
            b.connect('clicked', handler);
            return b;
        };
        box.add_child(button(_('Refresh'), 'view-refresh-symbolic', () => this._provider.refresh()));
        box.add_child(button(_('Settings'), 'emblem-system-symbolic', () => {
            this._menu.close();
            this._openPreferences();
        }));
        return box;
    }
}
