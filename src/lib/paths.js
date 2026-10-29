// SPDX-License-Identifier: GPL-2.0-or-later
// SPDX-FileCopyrightText: 2026 Mitja Cebokli
// Generated with AI for personal use.
// Do NOT upload to extensions.gnome.org (EGO) unless you understand JavaScript
// and can maintain this code.

// Where QuotaBuddy and Claude Code keep their files. Shared by the shell,
// prefs, the status-line bridge and the scan worker.

import GLib from 'gi://GLib';

const APP = 'quotabuddy';

export const cacheDir = () => GLib.build_filenamev([GLib.get_user_cache_dir(), APP]);
export const dataDir = () => GLib.build_filenamev([GLib.get_user_data_dir(), APP]);
export const configDir = () => GLib.build_filenamev([GLib.get_user_config_dir(), APP]);

// Written by the bridge on every status-line update.
export const bridgeFile = () => GLib.build_filenamev([cacheDir(), 'claude-status.json']);
// The status line the user had before the bridge was installed.
export const previousStatusLineFile = () => GLib.build_filenamev([configDir(), 'previous-statusline.json']);
// Byte offsets the worker has read up to, per log file.
export const scanStateFile = () => GLib.build_filenamev([cacheDir(), 'scan-state.json']);
// Written by the worker; read by the shell.
export const historyFile = () => GLib.build_filenamev([dataDir(), 'history.json']);

// override: the "Claude Code folder" setting; CLAUDE_CONFIG_DIR as Claude Code itself uses it.
export function claudeDir(override = '') {
    return override || GLib.getenv('CLAUDE_CONFIG_DIR') || GLib.build_filenamev([GLib.get_home_dir(), '.claude']);
}

export function readText(path) {
    try {
        const [, bytes] = GLib.file_get_contents(path);
        return new TextDecoder().decode(bytes);
    } catch {
        return null;
    }
}

// Atomic (temporary file + rename), so readers never see half a file.
export function writeText(path, text) {
    GLib.mkdir_with_parents(GLib.path_get_dirname(path), 0o700);
    GLib.file_set_contents(path, text);
}
