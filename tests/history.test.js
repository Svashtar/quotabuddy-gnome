import {test, assertEqual, done} from './harness.js';
import {emptyStore, parseStore, addEvent, prune, hourlySeries, dailySeries, summarySince, ranked, recentSessions,
    cacheHitRatio, projectName, totalTokens, dayKey} from '../src/lib/history.js';

const H = 3600 * 1000;
const NOW = new Date(2026, 9, 29, 15, 30).getTime();
const ev = (time, model, project, sessionId, output = 1e6) =>
    ({id: String(time), time, model, project, sessionId, usage: {input: 0, output, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0}});

function sample() {
    const s = emptyStore();
    addEvent(s, ev(NOW - 10 * 60e3, 'claude-opus-5-5', '/p/a', 's1'));
    addEvent(s, ev(NOW - 5 * 60e3, 'claude-haiku-4-5', '/p/a', 's1'));
    addEvent(s, ev(NOW - 2 * H, 'claude-opus-5-5', '/p/b', 's2'));
    addEvent(s, ev(NOW - 3 * 24 * H, 'claude-opus-5-5', '/p/b', 's3'));
    return s;
}

test('events land in hourly, daily and session buckets with cost', () => {
    const s = sample();
    const today = s.daily[dayKey(NOW)];
    assertEqual(today.models['claude-opus-5-5'].cost, 40);
    assertEqual(today.models['claude-haiku-4-5'].cost, 5);
    assertEqual(s.sessions.s1.replies, 2);
    assertEqual(s.sessions.s1.tokens, 2e6);
});

test('hourly series has 24 slots, newest last', () => {
    const series = hourlySeries(sample(), NOW);
    assertEqual(series.length, 24);
    assertEqual(series.at(-1).total.replies, 2);
    assertEqual(series.at(-3).total.replies, 1);
});

test('daily series covers 7 local days', () => {
    const series = dailySeries(sample(), NOW);
    assertEqual(series.length, 7);
    assertEqual(series.at(-1).day, dayKey(NOW));
    assertEqual(series.map(d => d.total.replies), [0, 0, 0, 1, 0, 0, 3]);
});

test('summary, ranking and sessions', () => {
    const s = sample();
    const week = summarySince(s, NOW - 6 * 24 * H);
    assertEqual(week.total.cost, 65);
    const top = ranked(week.projects);
    assertEqual(top.map(p => [projectName(p.key), p.totals.cost, Math.round(p.share * 100)]), [['b', 40, 62], ['a', 25, 38]]);
    assertEqual(recentSessions(s, NOW - 24 * H).map(x => x.id), ['s1', 's2']);
});

test('pruning drops old hours, days and sessions', () => {
    const s = sample();
    addEvent(s, ev(NOW - 20 * 24 * H, 'claude-opus-5-5', '/p/c', 'old'));
    addEvent(s, ev(NOW - 500 * 24 * H, 'claude-opus-5-5', '/p/c', 'ancient'));
    prune(s, NOW);
    assertEqual(Object.keys(s.hourly).length, 3);
    assertEqual(Object.keys(s.daily).length, 3);
    assertEqual(Object.keys(s.sessions).sort(), ['old', 's1', 's2', 's3']);
});

test('helpers', () => {
    assertEqual(cacheHitRatio({input: 10, cacheRead: 90, cacheWrite5m: 0, cacheWrite1h: 0}), 0.9);
    assertEqual(cacheHitRatio({input: 0, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0}), null);
    assertEqual(projectName('/home/me/x-gnome/'), 'x-gnome');
    assertEqual(projectName(''), '—');
    assertEqual(totalTokens({input: 1, output: 2, cacheRead: 3, cacheWrite5m: 4, cacheWrite1h: 5}), 15);
    assertEqual(parseStore('garbage').version, 1);
    assertEqual(Object.keys(parseStore(JSON.stringify(sample())).sessions).length, 3);
});

done();
