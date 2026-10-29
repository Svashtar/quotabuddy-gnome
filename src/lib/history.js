// SPDX-License-Identifier: GPL-2.0-or-later
// SPDX-FileCopyrightText: 2026 Mitja Cebokli
// Generated with AI for personal use.
// Do NOT upload to extensions.gnome.org (EGO) unless you understand JavaScript
// and can maintain this code.

// QuotaBuddy's own usage history, built from Claude Code's logs by the scan
// worker. It outlives Claude Code's log cleanup: hourly buckets for 14 days,
// daily ones for 400 days, sessions for 35 days. Pure so it can be unit tested.
//
// store: {version, hourly: {hourMs: bucket}, daily: {'YYYY-MM-DD': bucket},
//         sessions: {id: {project, start, end, replies, cost, tokens, models: {model: replies}}}}
// bucket: {models: {model: totals}, projects: {cwd: totals}}
// totals: {input, output, cacheRead, cacheWrite5m, cacheWrite1h, cost, replies}

import {costUsd} from './pricing.js';

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;
export const HOURLY_DAYS = 14;
export const DAILY_DAYS = 400;
export const SESSION_DAYS = 35;
export const STORE_VERSION = 1;

const TOKEN_FIELDS = ['input', 'output', 'cacheRead', 'cacheWrite5m', 'cacheWrite1h'];

export function emptyStore() {
    return {version: STORE_VERSION, hourly: {}, daily: {}, sessions: {}};
}

// A file from an older or broken run is started over rather than trusted.
export function parseStore(text) {
    try {
        const s = JSON.parse(text);
        if (s?.version === STORE_VERSION && s.hourly && s.daily && s.sessions)
            return s;
    } catch {}
    return emptyStore();
}

export function emptyTotals() {
    return {input: 0, output: 0, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0, cost: 0, replies: 0};
}

export function addTotals(into, from) {
    for (const f of [...TOKEN_FIELDS, 'cost', 'replies'])
        into[f] += from[f] ?? 0;
    return into;
}

export function totalTokens(t) {
    return TOKEN_FIELDS.reduce((sum, f) => sum + t[f], 0);
}

// Share of the prompt read from the cache instead of sent again, 0–1.
export function cacheHitRatio(t) {
    const prompt = t.input + t.cacheRead + t.cacheWrite5m + t.cacheWrite1h;
    return prompt ? t.cacheRead / prompt : null;
}

export function hourKey(ms) {
    return String(Math.floor(ms / HOUR) * HOUR);
}

// Local calendar day: "today" means the user's today.
export function dayKey(ms) {
    const d = new Date(ms);
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function bucket(map, key) {
    return (map[key] ??= {models: {}, projects: {}});
}

function addTo(map, key, totals) {
    addTotals(map[key] ??= emptyTotals(), totals);
}

// event: from logParser.parseLine
export function addEvent(store, event) {
    const totals = {...event.usage, cost: costUsd(event.model, event.usage), replies: 1};
    for (const b of [bucket(store.hourly, hourKey(event.time)), bucket(store.daily, dayKey(event.time))]) {
        addTo(b.models, event.model, totals);
        addTo(b.projects, event.project, totals);
    }
    if (event.sessionId) {
        const s = store.sessions[event.sessionId] ??=
            {project: event.project, start: event.time, end: event.time, replies: 0, cost: 0, tokens: 0, models: {}};
        s.start = Math.min(s.start, event.time);
        s.end = Math.max(s.end, event.time);
        s.replies++;
        s.cost += totals.cost;
        s.tokens += totalTokens(totals);
        s.models[event.model] = (s.models[event.model] ?? 0) + 1;
    }
}

export function prune(store, now) {
    for (const key of Object.keys(store.hourly)) {
        if (Number(key) < now - HOURLY_DAYS * DAY)
            delete store.hourly[key];
    }
    const oldestDay = dayKey(now - DAILY_DAYS * DAY);
    for (const key of Object.keys(store.daily)) {
        if (key < oldestDay)
            delete store.daily[key];
    }
    for (const [id, s] of Object.entries(store.sessions)) {
        if (s.end < now - SESSION_DAYS * DAY)
            delete store.sessions[id];
    }
    return store;
}

// Last `hours` hours, oldest first: [{t, models: {model: totals}, total}]
export function hourlySeries(store, now, hours = 24) {
    const last = Number(hourKey(now));
    const series = [];
    for (let i = hours - 1; i >= 0; i--) {
        const t = last - i * HOUR;
        const b = store.hourly[String(t)];
        series.push({t, models: b?.models ?? {}, total: sumMap(b?.models)});
    }
    return series;
}

// Last `days` local days including today, oldest first: [{day, models, total}]
export function dailySeries(store, now, days = 7) {
    const series = [];
    for (let i = days - 1; i >= 0; i--) {
        const day = dayKey(startOfDay(now) - i * DAY + 12 * HOUR);
        const b = store.daily[day];
        series.push({day, models: b?.models ?? {}, total: sumMap(b?.models)});
    }
    return series;
}

export function startOfDay(ms) {
    const d = new Date(ms);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
}

function sumMap(map) {
    const total = emptyTotals();
    for (const t of Object.values(map ?? {}))
        addTotals(total, t);
    return total;
}

// Totals from local day `fromDay` (inclusive) on: {total, models, projects}
export function summarySince(store, fromMs) {
    const fromDay = dayKey(fromMs);
    const models = {}, projects = {};
    for (const [day, b] of Object.entries(store.daily)) {
        if (day < fromDay)
            continue;
        for (const [m, t] of Object.entries(b.models))
            addTo(models, m, t);
        for (const [p, t] of Object.entries(b.projects))
            addTo(projects, p, t);
    }
    return {total: sumMap(models), models, projects};
}

// Biggest first by cost at API prices: [{key, totals, share}]
export function ranked(map, n = 5) {
    const all = Object.entries(map).map(([key, totals]) => ({key, totals}));
    const sum = all.reduce((s, e) => s + e.totals.cost, 0);
    return all
        .sort((a, b) => b.totals.cost - a.totals.cost)
        .slice(0, n)
        .map(e => ({...e, share: sum ? e.totals.cost / sum : 0}));
}

export function recentSessions(store, sinceMs, n = 5) {
    return Object.entries(store.sessions)
        .filter(([, s]) => s.end >= sinceMs)
        .map(([id, s]) => ({id, ...s}))
        .sort((a, b) => b.cost - a.cost)
        .slice(0, n);
}

// "/home/me/projects/quotabuddy-gnome" → "quotabuddy-gnome"
export function projectName(cwd) {
    return cwd ? cwd.replace(/\/+$/, '').split('/').pop() || '/' : '—';
}
