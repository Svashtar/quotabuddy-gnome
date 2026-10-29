// SPDX-License-Identifier: GPL-2.0-or-later
// SPDX-FileCopyrightText: 2026 Mitja Cebokli
// Generated with AI for personal use.
// Do NOT upload to extensions.gnome.org (EGO) unless you understand JavaScript
// and can maintain this code.

// One line of a Claude Code transcript (~/.claude/projects/**/*.jsonl) → a
// usage event, or null. Pure so it can be unit tested.

// Most lines are tool output and prompts: skip them before parsing JSON.
export function mayHaveUsage(line) {
    return line.includes('"usage"') && line.includes('"assistant"');
}

// event: {id, time (ms), model, project, sessionId,
//         usage: {input, output, cacheRead, cacheWrite5m, cacheWrite1h}}
export function parseLine(line) {
    if (!mayHaveUsage(line))
        return null;
    let o;
    try {
        o = JSON.parse(line);
    } catch {
        return null;
    }
    const m = o?.message;
    const u = m?.usage;
    if (o.type !== 'assistant' || !u || !m.model || m.model.startsWith('<'))
        return null;
    const time = Date.parse(o.timestamp);
    if (Number.isNaN(time))
        return null;

    const n = v => (Number.isFinite(v) ? v : 0);
    const write = n(u.cache_creation_input_tokens);
    // Older lines have no TTL breakdown; Claude Code writes the 5-minute cache then.
    const write1h = u.cache_creation ? n(u.cache_creation.ephemeral_1h_input_tokens) : 0;
    return {
        // The same reply is logged once per content block; message id and
        // request id together identify it.
        id: `${m.id ?? ''}:${o.requestId ?? ''}`,
        time,
        model: m.model,
        project: o.cwd ?? '',
        sessionId: o.sessionId ?? '',
        usage: {
            input: n(u.input_tokens),
            output: n(u.output_tokens),
            cacheRead: n(u.cache_read_input_tokens),
            cacheWrite5m: write - write1h,
            cacheWrite1h: write1h,
        },
    };
}
