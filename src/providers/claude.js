// SPDX-License-Identifier: GPL-2.0-or-later
// SPDX-FileCopyrightText: 2026 Mitja Cebokli
// Generated with AI for personal use.
// Do NOT upload to extensions.gnome.org (EGO) unless you understand JavaScript
// and can maintain this code.

// Everything QuotaBuddy knows about Claude, from three sources:
//  - the status-line bridge file (limits, while Claude Code runs here),
//  - the scan worker's history (tokens per model and project, from the logs),
//  - direct mode, when turned on (account-wide limits from Anthropic).
// The UI only talks to this class. Another provider would offer the same
// getters: windows, plan, history, status, forecast(). Shell process only
// (uses connectObject).

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Soup from 'gi://Soup?version=3.0';

import {fromStatusLine, fromDirect, spendFromDirect, mergeWindows} from '../lib/limits.js';
import {addSample, forecast} from '../lib/pace.js';
import {parseStore, emptyStore} from '../lib/history.js';
import {planId, planInfo} from '../lib/plan.js';
import {isInstalled} from '../lib/statusLineSetup.js';
import {bridgeFile, historyFile, cacheDir, dataDir, claudeDir, writeText} from '../lib/paths.js';

Gio._promisify(Gio.File.prototype, 'load_contents_async');
Gio._promisify(Gio.Subprocess.prototype, 'communicate_utf8_async');
Gio._promisify(Soup.Session.prototype, 'send_and_read_async');

const USAGE_URL = 'https://api.anthropic.com/api/oauth/usage';
const SCAN_EVERY_S = 120;
// Claude Code updates the status line after every reply; scanning the logs
// that often would be wasted work.
const SCAN_AFTER_BRIDGE_MS = 15 * 1000;
const MAX_BACKOFF_S = 30 * 60;

async function readJson(path, cancellable) {
    try {
        const [bytes] = await Gio.File.new_for_path(path).load_contents_async(cancellable);
        return JSON.parse(new TextDecoder().decode(bytes));
    } catch {
        return null;
    }
}

export class ClaudeProvider {
    id = 'claude';
    name = 'Claude';

    // onChange: called after any new data
    constructor({settings, extensionPath, version, onChange}) {
        this._settings = settings;
        this._path = extensionPath;
        this._version = version;
        this._onChange = onChange;
        this._cancellable = new Gio.Cancellable();
        this._bridgeWindows = [];
        this._directWindows = [];
        this._samples = {};
        this._history = emptyStore();
        this._planId = null;
        this._token = null;
        this._spend = null;
        this._status = {statusline: 0, direct: 0, logs: 0, directError: null, bridgeInstalled: false};
        this._monitors = [];
        this._sources = [];
        this._backoff = 1;
        this._scanning = false;
    }

    start() {
        this._settings.connectObject(
            'changed::direct-mode', () => this._restartDirect(),
            'changed::direct-interval', () => this._restartDirect(),
            'changed::plan-override', () => this._onChange(),
            'changed::claude-config-dir', () => this._restartMonitors(),
            this);
        GLib.mkdir_with_parents(cacheDir(), 0o700);
        GLib.mkdir_with_parents(dataDir(), 0o700);
        this._loadSamples();
        this._restartMonitors();
        this._sources.push(GLib.timeout_add_seconds(GLib.PRIORITY_LOW, SCAN_EVERY_S, () => {
            this._scan();
            return GLib.SOURCE_CONTINUE;
        }));
        this._readBridge();
        this._readHistory();
        this._scan();
        this._restartDirect();
    }

    destroy() {
        this._cancellable.cancel();
        this._settings.disconnectObject(this);
        this._stopMonitors();
        for (const id of this._sources)
            GLib.source_remove(id);
        this._sources = [];
        this._stopDirect();
        if (this._scanTimer)
            GLib.source_remove(this._scanTimer);
        this._scanTimer = null;
        this._saveSamples();
        this._session = null;
        this._token = null;
    }

    get windows() {
        return mergeWindows([this._bridgeWindows, this._directWindows], Date.now());
    }

    // {id, label, monthlyUsd, manual} or null
    get plan() {
        const manual = this._settings.get_string('plan-override');
        const id = manual || this._planId;
        const info = planInfo(id);
        return info ? {id, ...info, manual: !!manual} : null;
    }

    get history() {
        return this._history;
    }

    get spend() {
        return this._spend;
    }

    get status() {
        return {...this._status, directMode: this._directOn()};
    }

    forecast(window) {
        return forecast(window, this._samples[window.id] ?? [], Date.now());
    }

    // Footer button: everything now, direct mode included (once).
    refresh() {
        this._readBridge();
        this._scan();
        if (this._directOn())
            this._pollDirect();
    }


    _claudeDir() {
        return claudeDir(this._settings.get_string('claude-config-dir'));
    }

    _restartMonitors() {
        this._stopMonitors();
        const watch = (path, handler) => {
            const monitor = Gio.File.new_for_path(path).monitor_file(Gio.FileMonitorFlags.WATCH_MOVES, null);
            monitor.set_rate_limit(500);
            monitor.connect('changed', handler);
            this._monitors.push(monitor);
        };
        watch(bridgeFile(), () => this._readBridge());
        watch(historyFile(), () => this._readHistory());
        watch(GLib.build_filenamev([this._claudeDir(), '.credentials.json']), () => this._readCredentials());
        watch(GLib.build_filenamev([this._claudeDir(), 'settings.json']), () => this._readClaudeSettings());
        this._readCredentials();
        this._readClaudeSettings();
    }

    _stopMonitors() {
        for (const m of this._monitors) {
            m.cancel();
        }
        this._monitors = [];
    }

    async _readBridge() {
        const record = await readJson(bridgeFile(), this._cancellable);
        if (!record || this._cancellable.is_cancelled() || record.updatedAt <= this._status.statusline)
            return;
        this._status.statusline = record.updatedAt;
        this._bridgeWindows = fromStatusLine(record);
        this._addSamples(this._bridgeWindows);
        this._onChange();
        // New replies were just written to the logs.
        if (!this._scanTimer) {
            this._scanTimer = GLib.timeout_add(GLib.PRIORITY_LOW, SCAN_AFTER_BRIDGE_MS, () => {
                this._scanTimer = null;
                this._scan();
                return GLib.SOURCE_REMOVE;
            });
        }
    }

    async _readHistory() {
        const path = historyFile();
        try {
            const [bytes] = await Gio.File.new_for_path(path).load_contents_async(this._cancellable);
            this._history = parseStore(new TextDecoder().decode(bytes));
            this._onChange();
        } catch {}
    }

    async _readClaudeSettings() {
        const settings = await readJson(GLib.build_filenamev([this._claudeDir(), 'settings.json']), this._cancellable);
        if (this._cancellable.is_cancelled())
            return;
        this._status.bridgeInstalled = isInstalled(settings);
        this._onChange();
    }

    // Only the plan fields are kept, and the token only while direct mode is
    // on. QuotaBuddy never writes this file and never renews the token: when
    // it expires, Claude Code renews it and this monitor picks it up.
    async _readCredentials() {
        const creds = await readJson(GLib.build_filenamev([this._claudeDir(), '.credentials.json']), this._cancellable);
        if (this._cancellable.is_cancelled())
            return;
        const oauth = creds?.claudeAiOauth;
        this._planId = planId(oauth?.subscriptionType, oauth?.rateLimitTier);
        const hadToken = !!this._token;
        this._token = this._directOn() && oauth?.accessToken
            ? {value: oauth.accessToken, expiresAt: oauth.expiresAt ?? 0}
            : null;
        this._onChange();
        if (this._directOn() && this._token && (!hadToken || this._status.directError === 'expired')) {
            this._backoff = 1;
            this._pollDirect();
        }
    }


    async _scan() {
        if (this._scanning)
            return;
        this._scanning = true;
        try {
            const gjs = GLib.find_program_in_path('gjs');
            if (!gjs)
                throw new Error('gjs not found');
            const proc = Gio.Subprocess.new(
                [gjs, '-m', `${this._path}/worker/scanLogs.js`, this._settings.get_string('claude-config-dir')],
                Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_SILENCE);
            const [out] = await proc.communicate_utf8_async(null, this._cancellable);
            if (proc.get_successful()) {
                this._status.logs = Date.now();
                // A file monitor also notices the write, but not always
                // before the next scan; reading here keeps it simple.
                if (JSON.parse(out || '{}').events)
                    await this._readHistory();
                this._onChange();
            }
        } catch (e) {
            if (!e.matches?.(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED))
                console.warn(`QuotaBuddy: log scan failed: ${e.message}`);
        } finally {
            this._scanning = false;
        }
    }


    _samplesFile() {
        return GLib.build_filenamev([cacheDir(), 'samples.json']);
    }

    _loadSamples() {
        try {
            const [, bytes] = GLib.file_get_contents(this._samplesFile());
            this._samples = JSON.parse(new TextDecoder().decode(bytes)) ?? {};
        } catch {
            this._samples = {};
        }
    }

    _saveSamples() {
        try {
            writeText(this._samplesFile(), JSON.stringify(this._samples));
        } catch {}
    }

    _addSamples(windows) {
        for (const w of windows)
            this._samples[w.id] = addSample(this._samples[w.id] ?? [], w);
    }


    _directOn() {
        return this._settings.get_boolean('direct-mode') && this._settings.get_boolean('direct-accepted');
    }

    _restartDirect() {
        this._stopDirect();
        if (!this._directOn()) {
            this._directWindows = [];
            this._token = null;
            this._spend = null;
            this._status.directError = null;
            this._onChange();
            return;
        }
        this._session = new Soup.Session({user_agent: `QuotaBuddy/${this._version}`, timeout: 20});
        this._backoff = 1;
        this._readCredentials();
        this._scheduleDirect();
    }

    _stopDirect() {
        if (this._directTimer)
            GLib.source_remove(this._directTimer);
        this._directTimer = null;
        this._session?.abort();
    }

    _scheduleDirect(seconds = null) {
        if (this._directTimer)
            GLib.source_remove(this._directTimer);
        const interval = seconds ?? Math.min(MAX_BACKOFF_S, this._settings.get_uint('direct-interval') * this._backoff);
        this._directTimer = GLib.timeout_add_seconds(GLib.PRIORITY_LOW, interval, () => {
            this._directTimer = null;
            this._pollDirect();
            return GLib.SOURCE_REMOVE;
        });
    }

    async _pollDirect() {
        if (!this._directOn() || !this._session || this._polling)
            return;
        if (!this._token || this._token.expiresAt < Date.now()) {
            // Waits for Claude Code to renew it; the credentials monitor
            // starts polling again.
            this._status.directError = this._token ? 'expired' : 'no-token';
            this._onChange();
            return;
        }
        this._polling = true;
        let retryAfter = null;
        try {
            const msg = Soup.Message.new('GET', USAGE_URL);
            const h = msg.get_request_headers();
            h.append('Authorization', `Bearer ${this._token.value}`);
            h.append('anthropic-beta', 'oauth-2025-04-20');
            h.append('anthropic-version', '2023-06-01');
            h.append('Accept', 'application/json');
            const bytes = await this._session.send_and_read_async(msg, GLib.PRIORITY_LOW, this._cancellable);
            const code = msg.get_status();
            if (code === 200) {
                const json = JSON.parse(new TextDecoder().decode(bytes.toArray()));
                const now = Date.now();
                this._directWindows = fromDirect(json, now);
                this._spend = spendFromDirect(json);
                this._addSamples(this._directWindows);
                this._status.direct = now;
                this._status.directError = null;
                this._backoff = 1;
            } else if (code === 401 || code === 403) {
                this._status.directError = 'expired';
                this._token = null;
            } else if (code === 429) {
                this._status.directError = 'rate-limited';
                this._backoff = Math.min(this._backoff * 2, 8);
                retryAfter = Number(msg.get_response_headers().get_one('Retry-After')) || null;
            } else {
                this._status.directError = `HTTP ${code}`;
                this._backoff = Math.min(this._backoff * 2, 8);
            }
        } catch (e) {
            if (e.matches?.(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED))
                return;
            this._status.directError = 'network';
            this._backoff = Math.min(this._backoff * 2, 8);
        } finally {
            this._polling = false;
        }
        this._onChange();
        if (this._token)
            this._scheduleDirect(retryAfter ? Math.min(MAX_BACKOFF_S, Math.max(60, retryAfter)) : null);
    }
}
