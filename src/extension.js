// SPDX-License-Identifier: GPL-2.0-or-later
// SPDX-FileCopyrightText: 2026 Mitja Cebokli
// Generated with AI for personal use.
// Do NOT upload to extensions.gnome.org (EGO) unless you understand JavaScript
// and can maintain this code.

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

import {ClaudeProvider} from './providers/claude.js';
import {Indicator} from './ui/indicator.js';

export default class QuotaBuddyExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._provider = new ClaudeProvider({
            settings: this._settings,
            extensionPath: this.path,
            version: this.metadata['version-name'] ?? String(this.metadata.version ?? ''),
            onChange: () => this._indicator?.update(),
        });
        this._indicator = new Indicator({
            settings: this._settings,
            provider: this._provider,
            iconPath: `${this.path}/icons/quotabuddy-symbolic.svg`,
            // Rejected while the settings window is already open (GNOME allows
            // only one); that is harmless, so don't log it as an error.
            openPreferences: () => this.openPreferences().catch(() => {}),
        });
        Main.panel.addToStatusArea(this.uuid, this._indicator);
        this._provider.start();
    }

    disable() {
        // The provider first, so no update reaches a destroyed indicator.
        this._provider?.destroy();
        this._provider = null;
        this._indicator?.destroy();
        this._indicator = null;
        this._settings = null;
    }
}
