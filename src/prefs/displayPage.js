// SPDX-License-Identifier: GPL-2.0-or-later
// SPDX-FileCopyrightText: 2026 Mitja Cebokli
// Generated with AI for personal use.
// Do NOT upload to extensions.gnome.org (EGO) unless you understand JavaScript
// and can maintain this code.

import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';

import {gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import {PANEL_FIGURES, POPUP_SECTIONS} from '../lib/settingsBackup.js';

const PANEL_STYLES = ['rings-percent', 'bars-percent', 'rings', 'text'];
const PILL_STYLES = ['none', 'subtle', 'accent'];

// A combo row kept in step with a string key in both directions.
function enumRow(settings, key, values, labels, props, disconnectOnClose) {
    const row = new Adw.ComboRow({model: Gtk.StringList.new(labels), ...props});
    const sync = () => {
        row.selected = Math.max(0, values.indexOf(settings.get_string(key)));
    };
    sync();
    row.connect('notify::selected', () => settings.set_string(key, values[row.selected]));
    disconnectOnClose(settings.connect(`changed::${key}`, sync));
    return row;
}

// One switch per list entry; the list keeps the canonical order.
function listSwitches(group, settings, key, all, rows, disconnectOnClose) {
    const switches = {};
    for (const [value, title, subtitle] of rows) {
        const row = new Adw.SwitchRow({title, subtitle});
        row.connect('notify::active', () => {
            const current = settings.get_strv(key);
            const next = all.filter(v => (v === value ? row.active : current.includes(v)));
            if (next.join() !== current.join())
                settings.set_strv(key, next);
        });
        switches[value] = row;
        group.add(row);
    }
    const sync = () => {
        const current = settings.get_strv(key);
        for (const [value, row] of Object.entries(switches))
            row.active = current.includes(value);
    };
    sync();
    disconnectOnClose(settings.connect(`changed::${key}`, sync));
}

export const DisplayPage = GObject.registerClass(
class QuotaBuddyDisplayPage extends Adw.PreferencesPage {
    _init({window, settings}) {
        super._init({title: _('Display'), icon_name: 'preferences-desktop-appearance-symbolic', name: 'display'});

        const ids = [];
        const disconnectOnClose = id => ids.push(id);
        window.connect('close-request', () => {
            ids.forEach(id => settings.disconnect(id));
            return false;
        });

        const figures = new Adw.PreferencesGroup({
            title: _('Top Bar'),
            description: _('Shown left to right. Rings turn amber at 75 % used, red at 90 %, and amber early when the pace says you will hit the limit.'),
        });
        listSwitches(figures, settings, 'panel-figures', PANEL_FIGURES, [
            ['session', _('Session'), _('The rolling 5-hour limit')],
            ['week', _('Week'), _('The weekly limit for all models')],
            ['model-week', _('Model Week'), _('A model’s own weekly limit, such as Fable, when known')],
            ['reset', _('Session Reset'), _('Time until the session limit resets')],
            ['tokens-today', _('Tokens Today'), _('From Claude Code on this computer')],
            ['cost-today', _('Cost Today'), _('At API prices')],
        ], disconnectOnClose);
        this.add(figures);

        const look = new Adw.PreferencesGroup({title: _('Appearance')});
        look.add(enumRow(settings, 'panel-style', PANEL_STYLES,
                         [_('Rings and Percentages'), _('Bars and Percentages'), _('Rings Only'), _('Text Only')],
                         {title: _('Style')}, disconnectOnClose));
        const left = new Adw.SwitchRow({title: _('Show What Is Left'), subtitle: _('Otherwise show what is used')});
        settings.bind('show-left', left, 'active', Gio.SettingsBindFlags.DEFAULT);
        look.add(left);
        look.add(enumRow(settings, 'pill-style', PILL_STYLES, [_('None'), _('Subtle'), _('Accent Colour')],
                         {title: _('Background'), subtitle: _('Behind the figures')}, disconnectOnClose));
        this.add(look);

        const sections = new Adw.PreferencesGroup({
            title: _('Dropdown'),
            description: _('The limits are always shown. Choose what comes below them.'),
        });
        listSwitches(sections, settings, 'popup-sections', POPUP_SECTIONS, [
            ['pace', _('Pace'), _('Whether you are on track to stay inside each limit')],
            ['activity', _('Activity'), _('Charts of the last 24 hours or 7 days, by model')],
            ['cost', _('Cost at API Prices'), _('What your use would cost without a plan')],
            ['projects', _('Projects'), _('Busiest projects and sessions, cache use')],
        ], disconnectOnClose);
        this.add(sections);
    }
});
