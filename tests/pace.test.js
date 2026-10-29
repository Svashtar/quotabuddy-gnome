import {test, assertEqual, done} from './harness.js';
import {expectedPct, addSample, burnRate, forecast} from '../src/lib/pace.js';
import {SESSION_MS, WEEK_MS} from '../src/lib/limits.js';

const H = 3600 * 1000;
const session = (usedPct, resetsAt, updatedAt = 0) => ({kind: 'session', usedPct, resetsAt, durationMs: SESSION_MS, updatedAt});
const week = (usedPct, resetsAt) => ({kind: 'week', usedPct, resetsAt, durationMs: WEEK_MS, updatedAt: 0});

test('expected pct is elapsed share of the window', () => {
    assertEqual(expectedPct(session(0, 5 * H), 2.5 * H), 50);
    assertEqual(expectedPct(session(0, null), 1), null);
});

test('samples: new reset time starts over', () => {
    let s = addSample([], session(10, 5 * H, 1));
    s = addSample(s, session(20, 5 * H, 2));
    assertEqual(s.length, 2);
    s = addSample(s, session(1, 10 * H, 3));
    assertEqual(s, [{t: 3, pct: 1, resetsAt: 10 * H}]);
});

test('session burn rate uses the last hour', () => {
    const w = session(40, 5 * H);
    const samples = [{t: 3 * H, pct: 20, resetsAt: 5 * H}, {t: 3.5 * H, pct: 40, resetsAt: 5 * H}];
    assertEqual(burnRate(w, samples, 3.5 * H), 40);
});

test('week burn rate is the average since start', () => {
    const start = 0, resets = start + WEEK_MS;
    assertEqual(burnRate(week(24, resets), [], 24 * H), 1);
});

test('forecast: will hit the limit before reset', () => {
    const w = session(40, 5 * H);
    const samples = [{t: 3 * H, pct: 20, resetsAt: 5 * H}, {t: 3.5 * H, pct: 40, resetsAt: 5 * H}];
    const f = forecast(w, samples, 3.5 * H);
    assertEqual([f.status, f.hitAt], ['will-hit', 3.5 * H + 1.5 * H]);
});

test('forecast: on track and ahead', () => {
    assertEqual(forecast(week(10, WEEK_MS), [], 24 * H).status, 'on-track');
    const early = [{t: 0.5 * H, pct: 49, resetsAt: 5 * H}, {t: H, pct: 50, resetsAt: 5 * H}];
    assertEqual(forecast(session(50, 5 * H), early, H).status, 'ahead');
    assertEqual(forecast(week(0, WEEK_MS), [], 48 * H).status, 'idle');
    assertEqual(forecast(week(0, null), [], 48 * H).status, 'unknown');
});

done();
