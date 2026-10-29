// SPDX-License-Identifier: GPL-2.0-or-later
// SPDX-FileCopyrightText: 2026 Mitja Cebokli
// Generated with AI for personal use.
// Do NOT upload to extensions.gnome.org (EGO) unless you understand JavaScript
// and can maintain this code.

import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';

import {gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import {bridgeCommand, install, uninstall, isInstalled} from '../lib/statusLineSetup.js';
import {bridgeFile, previousStatusLineFile, claudeDir, readText, writeText} from '../lib/paths.js';
import {planId, planInfo} from '../lib/plan.js';
import {formatDuration} from '../lib/limits.js';
import {escapeMarkup} from '../lib/markdown.js';

const PLANS = ['', 'pro', 'max-5x', 'max-20x', 'team', 'enterprise'];
const DOCS = 'https://github.com/Svashtar/quotabuddy-gnome/blob/main/docs/privacy.md';

// null when the file is missing, undefined when it is not valid JSON
function readJsonFile(path) {
    const text = readText(path);
    if (text === null)
        return null;
    try {
        return JSON.parse(text);
    } catch {
        return undefined;
    }
}

export const DataPage = GObject.registerClass(
class QuotaBuddyDataPage extends Adw.PreferencesPage {
    _init({window, settings, path}) {
        super._init({title: _('Data'), icon_name: 'network-transmit-receive-symbolic', name: 'data'});
        this._window = window;
        this._settings = settings;
        this._path = path;

        const direct = new Adw.PreferencesGroup({
            title: _('Direct Mode (Recommended)'),
            description: _('The most complete figures: asks Anthropic every few minutes for your whole account, including the desktop app, ' +
                'other devices and model limits such as Fable. It uses an undocumented service with Claude Code’s sign-in, ' +
                'so it is off until you turn it on and read what that means.'),
        });
        this._directRow = new Adw.SwitchRow({title: _('Direct Mode'), subtitle: _('Read-only; the sign-in is never changed or renewed')});
        this._directRow.active = settings.get_boolean('direct-mode') && settings.get_boolean('direct-accepted');
        this._directRow.connect('notify::active', () => {
            this._onDirectToggled();
            this._refresh();
        });
        direct.add(this._directRow);

        const interval = new Adw.SpinRow({
            title: _('Check Every'),
            subtitle: _('Minutes between requests. Anthropic limits how often this may be asked.'),
            adjustment: new Gtk.Adjustment({lower: 2, upper: 30, step_increment: 1, page_increment: 5}),
        });
        interval.value = Math.round(settings.get_uint('direct-interval') / 60);
        interval.connect('notify::value', () => settings.set_uint('direct-interval', Math.round(interval.value) * 60));
        this._directRow.bind_property('active', interval, 'sensitive', GObject.BindingFlags.SYNC_CREATE);
        direct.add(interval);

        const privacy = new Adw.ActionRow({title: _('What Direct Mode Does'), activatable: true});
        privacy.add_suffix(new Gtk.Image({icon_name: 'adw-external-link-symbolic'}));
        privacy.connect('activated', () => new Gtk.UriLauncher({uri: DOCS}).launch(window, null, null));
        direct.add(privacy);
        this.add(direct);

        const bridge = new Adw.PreferencesGroup({
            title: _('Claude Code Status Line'),
            description: _('Works without any network use, but less complete: Claude Code only passes the session and weekly limits ' +
                'to its status line after replies in a terminal (not the desktop app), and leaves the session out after it resets. ' +
                'QuotaBuddy adds a small bridge there to receive them. A status line you already have keeps showing.'),
        });
        this._bridgeRow = new Adw.ActionRow({title: _('Status-Line Bridge')});
        this._bridgeButton = new Gtk.Button({valign: Gtk.Align.CENTER});
        this._bridgeButton.connect('clicked', () => this._toggleBridge());
        this._bridgeRow.add_suffix(this._bridgeButton);
        bridge.add(this._bridgeRow);
        this._lastRow = new Adw.ActionRow({title: _('Last Reading')});
        this._lastLabel = new Gtk.Label({css_classes: ['dim-label']});
        this._lastRow.add_suffix(this._lastLabel);
        bridge.add(this._lastRow);
        this.add(bridge);

        const account = new Adw.PreferencesGroup({title: _('Account')});
        const detected = planInfo(this._detectedPlan());
        const planRow = new Adw.ComboRow({
            title: _('Plan'),
            subtitle: _('For the badge and the plan value'),
            model: Gtk.StringList.new([
                /* Translators: %s is a plan name such as "Max 5×" */
                detected ? _('Automatic (%s)').format(detected.label) : _('Automatic'),
                ...PLANS.slice(1).map(id => planInfo(id).label),
            ]),
        });
        planRow.selected = Math.max(0, PLANS.indexOf(settings.get_string('plan-override')));
        planRow.connect('notify::selected', () => settings.set_string('plan-override', PLANS[planRow.selected]));
        account.add(planRow);

        const folder = new Adw.EntryRow({title: _('Claude Code Folder (empty: %s)').format(claudeDir(''))});
        folder.text = settings.get_string('claude-config-dir');
        folder.show_apply_button = true;
        folder.connect('apply', () => {
            settings.set_string('claude-config-dir', folder.text.trim());
            this._refresh();
        });
        account.add(folder);
        this.add(account);

        this._refresh();
        // The reading age changes while the window is open.
        this._timer = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 30, () => {
            this._refresh();
            return GLib.SOURCE_CONTINUE;
        });
        window.connect('close-request', () => {
            if (this._timer)
                GLib.source_remove(this._timer);
            this._timer = null;
            return false;
        });
    }

    _claudeSettingsPath() {
        return GLib.build_filenamev([claudeDir(this._settings.get_string('claude-config-dir')), 'settings.json']);
    }

    _detectedPlan() {
        const creds = readJsonFile(GLib.build_filenamev([claudeDir(this._settings.get_string('claude-config-dir')), '.credentials.json']));
        // Only the two plan fields are looked at.
        return planId(creds?.claudeAiOauth?.subscriptionType, creds?.claudeAiOauth?.rateLimitTier);
    }

    _refresh() {
        const claude = readJsonFile(this._claudeSettingsPath());
        const installed = isInstalled(claude ?? {});
        const previous = readJsonFile(previousStatusLineFile());
        if (claude === undefined) {
            this._bridgeRow.subtitle = _('Claude Code’s settings.json could not be read; fix it in Claude Code first.');
            this._bridgeButton.sensitive = false;
        } else if (installed) {
            this._bridgeRow.subtitle = previous ? _('Installed, showing your previous status line') : _('Installed');
            this._bridgeButton.sensitive = true;
        } else {
            this._bridgeRow.subtitle = claude?.statusLine ? _('Not installed. Your status line keeps showing after installing.') : _('Not installed');
            this._bridgeButton.sensitive = true;
        }
        this._bridgeButton.label = installed ? _('Remove') : _('Install…');
        this._bridgeButton.css_classes = installed || this._directRow.active ? [] : ['suggested-action'];

        const record = readJsonFile(bridgeFile());
        this._lastLabel.label = record?.updatedAt
            /* Translators: "12m ago" */
            ? _('%s ago').format(formatDuration(Date.now() - record.updatedAt))
            : _('None yet');
    }

    _toggleBridge() {
        const path = this._claudeSettingsPath();
        const claude = readJsonFile(path) ?? {};
        if (claude === undefined)
            return;
        if (isInstalled(claude)) {
            const previous = readJsonFile(previousStatusLineFile());
            this._writeClaudeSettings(path, uninstall(claude, previous ?? null));
            try {
                Gio.File.new_for_path(previousStatusLineFile()).delete(null);
            } catch {}
            this._toast(_('Bridge removed'));
            this._refresh();
            return;
        }

        const command = bridgeCommand(this._path);
        const {settings: next, previous} = install(claude, command);
        const before = claude.statusLine ? JSON.stringify(claude.statusLine, null, 2) : _('(none)');
        const dialog = new Adw.AlertDialog({
            heading: _('Install the Status-Line Bridge?'),
            body: _('QuotaBuddy changes one setting in %s. Removing the bridge here puts it back.').format(path),
        });
        const box = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL, spacing: 6});
        const code = (title, text) => {
            box.append(new Gtk.Label({label: title, xalign: 0, css_classes: ['heading']}));
            box.append(new Gtk.Label({
                label: `<tt>${escapeMarkup(text)}</tt>`, use_markup: true, xalign: 0, wrap: true, selectable: true,
                css_classes: ['card'], margin_bottom: 6,
            }));
        };
        code(_('statusLine now'), before);
        code(_('statusLine after'), JSON.stringify(next.statusLine, null, 2));
        dialog.set_extra_child(box);
        dialog.add_response('cancel', _('Cancel'));
        dialog.add_response('install', _('Install'));
        dialog.set_response_appearance('install', Adw.ResponseAppearance.SUGGESTED);
        dialog.connect('response', (_d, response) => {
            if (response !== 'install')
                return;
            if (previous)
                writeText(previousStatusLineFile(), JSON.stringify(previous));
            this._writeClaudeSettings(path, next);
            this._toast(_('Bridge installed. Figures arrive after the next reply in Claude Code.'));
            this._refresh();
        });
        dialog.present(this._window);
    }

    _writeClaudeSettings(path, value) {
        // A one-time copy of the file as it was before QuotaBuddy touched it.
        const backup = `${path}.quotabuddy-backup`;
        if (GLib.file_test(path, GLib.FileTest.EXISTS) && !GLib.file_test(backup, GLib.FileTest.EXISTS))
            Gio.File.new_for_path(path).copy(Gio.File.new_for_path(backup), Gio.FileCopyFlags.NONE, null, null);
        writeText(path, `${JSON.stringify(value, null, 2)}\n`);
    }

    _onDirectToggled() {
        const s = this._settings;
        if (!this._directRow.active) {
            s.set_boolean('direct-mode', false);
            return;
        }
        if (s.get_boolean('direct-accepted')) {
            s.set_boolean('direct-mode', true);
            return;
        }
        const dialog = new Adw.AlertDialog({
            heading: _('Turn On Direct Mode?'),
            body: [
                _('Direct mode asks api.anthropic.com for your usage with the sign-in Claude Code saved on this computer.'),
                _('This service is undocumented and may change or stop working at any time. ' +
                  'Anthropic’s Consumer Terms allow the subscription sign-in only in Claude Code and claude.ai, so using it here may go against them.'),
                _('QuotaBuddy only reads the sign-in, keeps it in memory, sends it nowhere but api.anthropic.com, and never renews or changes it.'),
            ].join('\n\n'),
        });
        dialog.add_response('cancel', _('Cancel'));
        dialog.add_response('enable', _('Turn On'));
        dialog.set_response_appearance('enable', Adw.ResponseAppearance.DESTRUCTIVE);
        dialog.set_close_response('cancel');
        dialog.connect('response', (_d, response) => {
            if (response === 'enable') {
                s.set_boolean('direct-accepted', true);
                s.set_boolean('direct-mode', true);
            } else {
                this._directRow.active = false;
            }
        });
        dialog.present(this._window);
    }

    _toast(title) {
        this._window.add_toast(new Adw.Toast({title}));
    }
});
