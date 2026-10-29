// SPDX-License-Identifier: GPL-2.0-or-later
// SPDX-FileCopyrightText: 2026 Mitja Cebokli
// Generated with AI for personal use.
// Do NOT upload to extensions.gnome.org (EGO) unless you understand JavaScript
// and can maintain this code.

import Gdk from 'gi://Gdk';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk';
import System from 'system';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
import * as Config from 'resource:///org/gnome/Shell/Extensions/js/misc/config.js';

import {formatDebugInfo, formatGjsVersion} from './lib/debugInfo.js';
import {fromStatusLine} from './lib/limits.js';
import {parseStore} from './lib/history.js';
import {planId, planInfo} from './lib/plan.js';
import {isInstalled} from './lib/statusLineSetup.js';
import {bridgeFile, historyFile, scanStateFile, claudeDir, readText} from './lib/paths.js';
import {AboutPage} from './prefs/aboutPage.js';
import {DataPage} from './prefs/dataPage.js';
import {DisplayPage} from './prefs/displayPage.js';

const json = path => {
    try {
        return JSON.parse(readText(path) ?? 'null');
    } catch {
        return null;
    }
};

export default class QuotaBuddyPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        Gtk.IconTheme.get_for_display(Gdk.Display.get_default()).add_search_path(`${this.path}/icons`);
        const settings = this.getSettings();
        window.set_default_size(720, 780);
        window.search_enabled = true;

        window.add(new DisplayPage({window, settings}));
        window.add(new DataPage({window, settings, path: this.path}));
        window.add(new AboutPage({
            window,
            settings,
            metadata: this.metadata,
            path: this.path,
            getDebugInfo: () => this._debugInfo(settings),
        }));
    }

    _debugInfo(settings) {
        const dir = claudeDir(settings.get_string('claude-config-dir'));
        const bridge = json(bridgeFile());
        const history = parseStore(readText(historyFile()) ?? '');
        const creds = json(GLib.build_filenamev([dir, '.credentials.json']))?.claudeAiOauth;
        const plan = planInfo(settings.get_string('plan-override') || planId(creds?.subscriptionType, creds?.rateLimitTier));
        let scanned = 0;
        try {
            const info = Gio.File.new_for_path(scanStateFile()).query_info('time::modified', Gio.FileQueryInfoFlags.NONE, null);
            scanned = info.get_modification_date_time().to_unix() * 1000;
        } catch {}
        return Promise.resolve(formatDebugInfo({
            extensionVersion: this.metadata['version-name'],
            commit: this.metadata.commit,
            shellVersion: Config.PACKAGE_VERSION,
            gjsVersion: formatGjsVersion(System.version),
            os: GLib.get_os_info('PRETTY_NAME') ?? 'unknown',
            sessionType: GLib.getenv('XDG_SESSION_TYPE') ?? 'unknown',
            now: Date.now(),
            settings: {
                panelFigures: settings.get_strv('panel-figures'),
                panelStyle: settings.get_string('panel-style'),
                showLeft: settings.get_boolean('show-left'),
                pillStyle: settings.get_string('pill-style'),
                popupSections: settings.get_strv('popup-sections'),
                directMode: settings.get_boolean('direct-mode') && settings.get_boolean('direct-accepted'),
                directInterval: settings.get_uint('direct-interval'),
                planOverride: settings.get_string('plan-override'),
            },
            plan: plan?.label ?? null,
            bridgeInstalled: isInstalled(json(GLib.build_filenamev([dir, 'settings.json'])) ?? {}),
            sources: {statusline: bridge?.updatedAt ?? 0, direct: 0, logs: scanned},
            windows: fromStatusLine(bridge).map(w => w.id),
            historyDays: Object.keys(history.daily).length,
        }));
    }
}
