import {test, assertEqual, done} from './harness.js';
import {fromStatusLine, fromDirect, spendFromDirect, mergeWindows, severity, formatDuration} from '../src/lib/limits.js';

const H = 3600 * 1000;

test('status line: both windows, seconds become ms', () => {
    const w = fromStatusLine({updatedAt: 1000, rateLimits: {
        five_hour: {used_percentage: 38.4, resets_at: 1700000000},
        seven_day: {used_percentage: 61, resets_at: 1700500000},
    }});
    assertEqual(w.map(x => [x.id, x.usedPct, x.resetsAt, x.source]), [
        ['session', 38.4, 1700000000000, 'statusline'],
        ['week', 61, 1700500000000, 'statusline'],
    ]);
});

test('status line: missing windows and bad values are skipped', () => {
    assertEqual(fromStatusLine({updatedAt: 1, rateLimits: {five_hour: {used_percentage: 'x'}}}), []);
    assertEqual(fromStatusLine(null), []);
});

test('direct: limits[] with model-scoped week', () => {
    const w = fromDirect({limits: [
        {kind: 'session', percent: 12, resets_at: '2026-10-29T15:00:00Z'},
        {kind: 'weekly_all', percent: 140, resets_at: null},
        {kind: 'weekly_scoped', percent: 30, scope: {model: {display_name: 'Fable'}}},
        {kind: 'something_new', percent: 5},
    ]}, 5);
    assertEqual(w.map(x => [x.id, x.usedPct, x.resetsAt]), [
        ['session', 12, Date.parse('2026-10-29T15:00:00Z')],
        ['week', 100, null],
        ['week:fable', 30, null],
    ]);
});

test('direct: legacy flat keys', () => {
    const w = fromDirect({five_hour: {utilization: 4, resets_at: null}, seven_day_opus: {utilization: 9}, extra_usage: {is_enabled: false}}, 5);
    assertEqual(w.map(x => [x.id, x.model]), [['session', null], ['week:opus', 'Opus']]);
});

test('direct: spend in minor units', () => {
    assertEqual(spendFromDirect({spend: {used: {amount_minor: 1250, currency: 'EUR', exponent: 2}, limit: {amount_minor: 5000}, percent: 25}}),
                {usedAmount: 12.5, limitAmount: 50, currency: 'EUR', usedPct: 25});
    assertEqual(spendFromDirect({}), null);
});

test('merge: newest reading wins, expired windows reset', () => {
    const now = 10 * H;
    const a = {id: 'session', kind: 'session', usedPct: 50, resetsAt: 12 * H, updatedAt: 1};
    const b = {id: 'session', kind: 'session', usedPct: 60, resetsAt: 12 * H, updatedAt: 2};
    const old = {id: 'week', kind: 'week', usedPct: 80, resetsAt: 9 * H, updatedAt: 1};
    const m = mergeWindows([[a, old], [b]], now);
    assertEqual(m.map(x => [x.id, x.usedPct, !!x.expired]), [['session', 60, false], ['week', 0, true]]);
});

test('severity thresholds', () => {
    assertEqual([10, 75, 89.9, 90].map(severity), ['normal', 'warning', 'warning', 'critical']);
});

test('durations', () => {
    assertEqual([0, 20e3, 45 * 60e3, 2 * H, 2 * H + 14 * 60e3, 76 * H, 48 * H].map(formatDuration),
                ['now', '1m', '45m', '2h', '2h 14m', '3d 4h', '2d']);
});

done();
