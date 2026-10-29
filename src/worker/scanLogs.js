// SPDX-License-Identifier: GPL-2.0-or-later
// SPDX-FileCopyrightText: 2026 Mitja Cebokli
// Generated with AI for personal use.
// Do NOT upload to extensions.gnome.org (EGO) unless you understand JavaScript
// and can maintain this code.

// Reads new lines from Claude Code's transcripts into QuotaBuddy's history.
// Run by the extension as `gjs -m scanLogs.js <claude dir>`, out of the shell
// process: logs grow by hundreds of megabytes a week. Only bytes added since
// the last run are read. Prints one JSON line: {events, files, ms}.

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

import {parseLine, mayHaveUsage} from '../lib/logParser.js';
import {parseStore, addEvent, prune} from '../lib/history.js';
import {historyFile, scanStateFile, readText, writeText, claudeDir} from '../lib/paths.js';

const DAY = 24 * 3600 * 1000;
const FIRST_RUN_DAYS = 35;
// Replies already counted, kept this long: copies of a reply appear close
// together (one per content block) or in a resumed session's new file.
const SEEN_MS = 3 * DAY;
const CHUNK = 1 << 20;
const STATE_VERSION = 1;

function loadState() {
    try {
        const s = JSON.parse(readText(scanStateFile()) ?? '');
        if (s?.version === STATE_VERSION)
            return s;
    } catch {}
    return {version: STATE_VERSION, files: {}, seen: {}};
}

function* jsonlFiles(dir) {
    let en;
    try {
        en = Gio.File.new_for_path(dir).enumerate_children('standard::name,standard::type,standard::size,time::modified',
                                                           Gio.FileQueryInfoFlags.NOFOLLOW_SYMLINKS, null);
    } catch {
        return;
    }
    let info;
    while ((info = en.next_file(null))) {
        const path = GLib.build_filenamev([dir, info.get_name()]);
        if (info.get_file_type() === Gio.FileType.DIRECTORY)
            yield* jsonlFiles(path);
        else if (info.get_name().endsWith('.jsonl'))
            yield {path, size: info.get_size(), mtime: info.get_modification_date_time().to_unix() * 1000};
    }
    en.close(null);
}

// Calls onLine for each complete line from `offset`; returns the offset after
// the last complete line, so a line still being written is read next time.
function readLines(path, offset, onLine) {
    const stream = Gio.File.new_for_path(path).read(null);
    stream.seek(offset, GLib.SeekType.SET, null);
    const decoder = new TextDecoder();
    let pos = offset, rest = new Uint8Array(0), bytes;
    while ((bytes = stream.read_bytes(CHUNK, null)).get_size() > 0) {
        const chunk = bytes.toArray();
        const data = rest.length ? concat(rest, chunk) : chunk;
        const end = data.lastIndexOf(10) + 1;
        if (end > 0) {
            for (const line of decoder.decode(data.subarray(0, end)).split('\n')) {
                if (mayHaveUsage(line))
                    onLine(line);
            }
            pos += end;
        }
        rest = data.slice(end);
    }
    stream.close(null);
    return pos;
}

function concat(a, b) {
    const all = new Uint8Array(a.length + b.length);
    all.set(a);
    all.set(b, a.length);
    return all;
}

const started = Date.now();
const state = loadState();
const store = parseStore(readText(historyFile()) ?? '');
const firstRun = Object.keys(state.files).length === 0;
let events = 0, files = 0;

for (const f of jsonlFiles(GLib.build_filenamev([claudeDir(ARGV[0] ?? ''), 'projects']))) {
    const known = state.files[f.path];
    let offset = known?.offset ?? 0;
    if (offset > f.size)
        offset = 0; // rewritten from scratch
    if (!known && firstRun && f.mtime < started - FIRST_RUN_DAYS * DAY)
        offset = f.size;
    if (offset < f.size) {
        files++;
        try {
            offset = readLines(f.path, offset, line => {
                const e = parseLine(line);
                if (!e || state.seen[e.id])
                    return;
                state.seen[e.id] = e.time;
                addEvent(store, e);
                events++;
            });
        } catch (e) {
            printerr(`QuotaBuddy: ${f.path}: ${e.message}`);
        }
    }
    state.files[f.path] = {offset};
}

// Forget files Claude Code has cleaned up, and old reply ids.
for (const path of Object.keys(state.files)) {
    if (!GLib.file_test(path, GLib.FileTest.EXISTS))
        delete state.files[path];
}
for (const [id, t] of Object.entries(state.seen)) {
    if (t < started - SEEN_MS)
        delete state.seen[id];
}

prune(store, started);
if (events)
    writeText(historyFile(), JSON.stringify(store));
writeText(scanStateFile(), JSON.stringify(state));
print(JSON.stringify({events, files, ms: Date.now() - started}));
