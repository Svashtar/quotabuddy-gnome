// SPDX-License-Identifier: GPL-2.0-or-later
// SPDX-FileCopyrightText: 2026 Mitja Cebokli
// Generated with AI for personal use.
// Do NOT upload to extensions.gnome.org (EGO) unless you understand JavaScript
// and can maintain this code.

// The top-bar button: a pill holding one small gauge and figure per chosen
// item. Its menu is the dropdown (popup.js).

import GObject from 'gi://GObject';
import St from 'gi://St';
import Clutter from 'gi://Clutter';

import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import {gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';

import {severity, formatDuration} from '../lib/limits.js';
import {summarySince, startOfDay, totalTokens} from '../lib/history.js';
import {formatTokens, formatMoney, shownPct} from '../lib/format.js';
import {Gauge} from './gauge.js';
import {Popup} from './popup.js';

// Pace says the limit is hit before the reset: warn before the numbers do.
function levelFor(window, fc) {
    const level = severity(window.usedPct);
    return level === 'normal' && fc?.status === 'will-hit' ? 'warning' : level;
}

export const Indicator = GObject.registerClass(
class QuotaBuddyIndicator extends PanelMenu.Button {
    _init({settings, provider, openPreferences}) {
        super._init(0.5, 'QuotaBuddy');
        this._settings = settings;
        this._provider = provider;
        this.add_style_class_name('quotabuddy-button');

        this._pill = new St.BoxLayout({style_class: 'quotabuddy-pill', y_align: Clutter.ActorAlign.CENTER});
        this.add_child(this._pill);

        this._popup = new Popup({menu: this.menu, settings, provider, openPreferences});

        settings.connectObject(
            'changed::panel-figures', () => this.update(),
            'changed::panel-style', () => this.update(),
            'changed::show-left', () => this.update(),
            'changed::pill-style', () => this.update(),
            this);
        this.connect('destroy', () => {
            this._settings.disconnectObject(this);
            this._popup.destroy();
        });
        this.update();
    }

    update() {
        this._pill.destroy_all_children();
        const style = this._settings.get_string('panel-style');
        const showLeft = this._settings.get_boolean('show-left');
        const pill = this._settings.get_string('pill-style');
        this._pill.style_class = `quotabuddy-pill quotabuddy-pill-${pill} quotabuddy-style-${style}`;

        const windows = this._provider.windows;
        const items = this._settings.get_strv('panel-figures').map(f => this._item(f, windows, showLeft)).filter(Boolean);
        if (!items.length)
            items.push({label: '–', fraction: 0, level: 'idle', gauge: true, short: 'Q'});

        const accessible = [];
        for (const item of items) {
            const box = new St.BoxLayout({style_class: 'quotabuddy-figure', y_align: Clutter.ActorAlign.CENTER});
            if (item.gauge && style !== 'text') {
                const shape = style === 'bars-percent' ? 'bar' : 'ring';
                const gauge = new Gauge({
                    shape,
                    thickness: 0.2,
                    style_class: `quotabuddy-panel-${shape} quotabuddy-${item.level}`,
                    y_align: Clutter.ActorAlign.CENTER,
                });
                gauge.setValue(item.fraction);
                box.add_child(gauge);
            }
            if (style !== 'rings' || !item.gauge) {
                const text = style === 'text' && item.short ? `${item.short} ${item.label}` : item.label;
                box.add_child(new St.Label({
                    text,
                    style_class: `quotabuddy-figure-label quotabuddy-${item.level}-text`,
                    y_align: Clutter.ActorAlign.CENTER,
                }));
            }
            this._pill.add_child(box);
            accessible.push(item.accessible ?? item.label);
        }
        this.accessible_name = `QuotaBuddy: ${accessible.join(', ')}`;
        if (this.menu.isOpen)
            this._popup.update();
    }

    // {label, fraction, level, gauge, short, accessible} or null when there is nothing to show
    _item(figure, windows, showLeft) {
        const byKind = kind => windows.find(w => w.kind === kind);
        const pctItem = (w, short, name) => {
            const pct = shownPct(w.usedPct, showLeft);
            return {
                label: `${pct}%`,
                fraction: pct / 100,
                level: w.expired ? 'idle' : levelFor(w, this._provider.forecast(w)),
                gauge: true,
                short,
                /* Translators: accessible text, e.g. "Session: 62% left" */
                accessible: (showLeft ? _('%s: %d%% left') : _('%s: %d%% used')).format(name, pct),
            };
        };
        switch (figure) {
        case 'session': {
            const w = byKind('session');
            /* Translators: one-letter tag for the 5-hour session in text-only style */
            return w ? pctItem(w, _('S'), _('Session')) : {label: '–', fraction: 0, level: 'idle', gauge: true, short: _('S')};
        }
        case 'week': {
            const w = byKind('week');
            /* Translators: one-letter tag for the weekly limit in text-only style */
            return w ? pctItem(w, _('W'), _('Week')) : {label: '–', fraction: 0, level: 'idle', gauge: true, short: _('W')};
        }
        case 'model-week': {
            const w = byKind('model-week');
            return w ? pctItem(w, w.model?.[0] ?? 'M', w.model ?? _('Model')) : null;
        }
        case 'reset': {
            const w = byKind('session');
            if (!w?.resetsAt)
                return null;
            const left = formatDuration(w.resetsAt - Date.now());
            return {label: `↻ ${left}`, level: 'normal', gauge: false, accessible: _('Session resets in %s').format(left)};
        }
        case 'tokens-today': {
            const t = summarySince(this._provider.history, startOfDay(Date.now())).total;
            return {label: formatTokens(totalTokens(t)), level: 'normal', gauge: false, accessible: _('%s tokens today').format(formatTokens(totalTokens(t)))};
        }
        case 'cost-today': {
            const t = summarySince(this._provider.history, startOfDay(Date.now())).total;
            return {label: formatMoney(t.cost), level: 'normal', gauge: false, accessible: _('%s at API prices today').format(formatMoney(t.cost))};
        }
        default:
            return null;
        }
    }
});
