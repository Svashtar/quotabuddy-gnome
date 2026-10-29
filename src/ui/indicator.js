// SPDX-License-Identifier: GPL-2.0-or-later
// SPDX-FileCopyrightText: 2026 Mitja Cebokli
// Generated with AI for personal use.
// Do NOT upload to extensions.gnome.org (EGO) unless you understand JavaScript
// and can maintain this code.

// The top-bar button: a pill holding one small gauge and figure per chosen
// item. A left click opens the dropdown (popup.js), a right click a short
// menu of quick actions. Both menus are our own, so the button handles the
// clicks itself instead of PanelMenu.Button's single menu.

import GObject from 'gi://GObject';
import Gio from 'gi://Gio';
import St from 'gi://St';
import Clutter from 'gi://Clutter';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import {gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';

import {severity, formatDuration} from '../lib/limits.js';
import {summarySince, startOfDay, totalTokens} from '../lib/history.js';
import {formatTokens, formatMoney, shownPct} from '../lib/format.js';
import {Gauge} from './gauge.js';
import {familyColorCss} from './chart.js';
import {modelFamily} from '../lib/pricing.js';
import {Popup} from './popup.js';

const USAGE_URL = 'https://claude.ai/settings/usage';

// Pace says the limit is hit before the reset: warn before the numbers do.
function levelFor(window, fc) {
    const level = severity(window.usedPct);
    return level === 'normal' && fc?.status === 'will-hit' ? 'warning' : level;
}

export const Indicator = GObject.registerClass(
class QuotaBuddyIndicator extends PanelMenu.Button {
    _init({settings, provider, iconPath, openPreferences}) {
        super._init(0.5, 'QuotaBuddy', true);
        this._settings = settings;
        this._provider = provider;
        this._openPreferences = openPreferences;
        this._gicon = Gio.FileIcon.new(Gio.File.new_for_path(iconPath));
        this.add_style_class_name('quotabuddy-button');

        this._pill = new St.BoxLayout({style_class: 'quotabuddy-pill', y_align: Clutter.ActorAlign.CENTER});
        this.add_child(this._pill);

        this._main = this._addMenu();
        this._popup = new Popup({menu: this._main, settings, provider, openPreferences});
        this._quick = this._addMenu();
        this._buildQuickMenu();

        const click = new Clutter.ClickGesture({recognize_on_press: true});
        click.connect('recognize', () => {
            if (click.get_button() === Clutter.BUTTON_SECONDARY)
                this._toggle(this._quick);
            else
                this._toggle(this._main);
        });
        this.add_action(click);

        // Enter/space for the dropdown; the Menu key or Shift+F10, like a
        // right click elsewhere, for the quick actions.
        const keys = new Clutter.KeyController();
        keys.connect('key-press', () => {
            const [, symbol] = keys.get_key();
            const shift = (keys.get_state() & Clutter.ModifierType.SHIFT_MASK) !== 0;
            if (symbol === Clutter.KEY_Menu || (symbol === Clutter.KEY_F10 && shift))
                this._toggle(this._quick);
            else if ([Clutter.KEY_Return, Clutter.KEY_KP_Enter, Clutter.KEY_space].includes(symbol))
                this._toggle(this._main);
            else
                return Clutter.EVENT_PROPAGATE;
            return Clutter.EVENT_STOP;
        });
        this.add_action(keys);

        settings.connectObject(
            'changed::panel-figures', () => this.update(),
            'changed::panel-style', () => this.update(),
            'changed::show-left', () => this.update(),
            'changed::pill-style', () => this.update(),
            this);
        this.connect('destroy', () => {
            this._settings.disconnectObject(this);
            this._popup.destroy();
            this._main.destroy();
            this._quick.destroy();
        });
        this.update();
    }

    // A panel menu like PanelMenu.Button's own, registered with the panel so
    // keyboard navigation and closing on outside clicks work as usual.
    // Anchored to the button's right edge rather than its centre: the button
    // sits in the panel's right box, so it grows and shrinks to the left as
    // the figures change, and an open menu would otherwise slide sideways.
    _addMenu() {
        const menu = new PopupMenu.PopupMenu(this, 1.0, St.Side.TOP);
        menu.setSourceAlignment(1.0);
        menu.actor.add_style_class_name('panel-menu');
        menu.connect('open-state-changed', (_m, open) => {
            if (this._main.isOpen || this._quick?.isOpen)
                this.add_style_pseudo_class('active');
            else
                this.remove_style_pseudo_class('active');
            if (open)
                this._fitToScreen(menu);
        });
        Main.uiGroup.add_child(menu.actor);
        menu.actor.hide();
        Main.panel.menuManager.addMenu(menu);
        return menu;
    }

    // As PanelMenu.Button does for its own menu: never taller than the work
    // area (in logical pixels, as CSS is).
    _fitToScreen(menu) {
        const workArea = Main.layoutManager.getWorkAreaForMonitor(Main.layoutManager.primaryIndex);
        const scale = St.ThemeContext.get_for_stage(global.stage).scale_factor;
        const margins = menu.actor.margin_top + menu.actor.margin_bottom;
        menu.actor.style = `max-height: ${Math.round((workArea.height - margins) / scale)}px;`;
    }

    _toggle(menu) {
        const other = menu === this._main ? this._quick : this._main;
        if (other.isOpen)
            other.close();
        menu.toggle();
    }

    _buildQuickMenu() {
        const menu = this._quick;
        menu.addAction(_('Refresh Now'), () => this._provider.refresh());
        this._showLeft = new PopupMenu.PopupSwitchMenuItem(_('Show What Is Left'), this._settings.get_boolean('show-left'));
        this._showLeft.connect('toggled', (_item, state) => this._settings.set_boolean('show-left', state));
        menu.addMenuItem(this._showLeft);
        menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this._setup = menu.addAction(_('Set Up Usage Limits…'), () => this._openPreferences());
        menu.addAction(_('Open Usage on claude.ai'), () => {
            try {
                Gio.AppInfo.launch_default_for_uri(USAGE_URL, global.create_app_launch_context(0, -1));
            } catch (e) {
                console.warn(`QuotaBuddy: could not open ${USAGE_URL}: ${e.message}`);
            }
        });
        menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        menu.addAction(_('Settings'), () => this._openPreferences());

        // Kept current when it opens: the setting can change in the preferences.
        menu.connect('open-state-changed', (_m, open) => {
            if (!open)
                return;
            this._showLeft.setToggleState(this._settings.get_boolean('show-left'));
            const status = this._provider.status;
            this._setup.visible = !status.bridgeInstalled && !status.directMode;
        });
    }

    update() {
        this._pill.destroy_all_children();
        const style = this._settings.get_string('panel-style');
        const showLeft = this._settings.get_boolean('show-left');
        const pill = this._settings.get_string('pill-style');
        this._pill.style_class = `quotabuddy-pill quotabuddy-pill-${pill} quotabuddy-style-${style}`;

        const windows = this._provider.windows;
        // No limits yet (first run, nothing set up): the QuotaBuddy icon, so the
        // button is easy to find, rather than empty rings and dashes.
        if (!windows.length) {
            this._pill.add_child(new St.Icon({gicon: this._gicon, style_class: 'system-status-icon quotabuddy-panel-icon'}));
            this.accessible_name = _('QuotaBuddy: no usage limits yet');
            if (this._main.isOpen)
                this._popup.update();
            return;
        }
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
                // A model's own limit in its family colour (as in the activity
                // chart), so it stands apart from the session and week rings;
                // amber and red still win.
                if (item.family && item.level === 'normal')
                    gauge.style = familyColorCss(item.family);
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
        if (this._main.isOpen)
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
            return w ? {...pctItem(w, w.model?.[0] ?? 'M', w.model ?? _('Model')), family: modelFamily(w.model)} : null;
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
