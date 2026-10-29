// SPDX-License-Identifier: GPL-2.0-or-later
// SPDX-FileCopyrightText: 2026 Mitja Cebokli
// Generated with AI for personal use.
// Do NOT upload to extensions.gnome.org (EGO) unless you understand JavaScript
// and can maintain this code.

// Claude Code status line → QuotaBuddy. Claude Code runs this after each
// reply with the session's details as JSON on stdin (documented at
// https://code.claude.com/docs/en/statusline). It saves the usage limits for
// the extension and prints a status line: the user's previous one if they had
// one, else a short summary. Never fails loudly: a broken status line would
// annoy more than missing data.

import Gio from 'gi://Gio';
import GioUnix from 'gi://GioUnix';

import {bridgeFile, previousStatusLineFile, readText, writeText} from '../lib/paths.js';
import {bridgeRecord, compactLine} from '../lib/statusLineSetup.js';

function readStdin() {
    const stream = new GioUnix.InputStream({fd: 0, close_fd: false});
    const chunks = [];
    let bytes;
    while ((bytes = stream.read_bytes(65536, null)).get_size() > 0)
        chunks.push(bytes.toArray());
    const all = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
    let at = 0;
    for (const c of chunks) {
        all.set(c, at);
        at += c.length;
    }
    return new TextDecoder().decode(all);
}

function runPrevious(command, text) {
    const proc = Gio.Subprocess.new(['/bin/sh', '-c', command],
                                    Gio.SubprocessFlags.STDIN_PIPE | Gio.SubprocessFlags.STDOUT_PIPE);
    const [, out] = proc.communicate_utf8(text, null);
    return out ?? '';
}

const text = readStdin();
let input = null;
try {
    input = JSON.parse(text);
} catch {}

try {
    const record = bridgeRecord(input, Date.now());
    if (record)
        writeText(bridgeFile(), JSON.stringify(record));
} catch (e) {
    printerr(`QuotaBuddy: ${e.message}`);
}

let line = null;
try {
    const previous = JSON.parse(readText(previousStatusLineFile()) ?? 'null');
    if (previous?.type === 'command' && previous.command)
        line = runPrevious(previous.command, text).replace(/\n$/, '');
} catch (e) {
    printerr(`QuotaBuddy: ${e.message}`);
}
print(line ?? compactLine(input));
