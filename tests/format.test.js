import {test, assertEqual, done} from './harness.js';
import {formatTokens, formatMoney, shownPct} from '../src/lib/format.js';

test('tokens', () => {
    assertEqual([0, 999, 1500, 350e3, 1.25e6, 12e6, 3.4e9].map(formatTokens), ['0', '999', '2k', '350k', '1.3M', '12M', '3.4B']);
});

test('money keeps cents below 100', () => {
    assertEqual(formatMoney(39.7).replace(/[^\d.,]/g, ''), '39.70');
    assertEqual(formatMoney(1204.4).replace(/[^\d]/g, ''), '1204');
});

test('left or used', () => {
    assertEqual([shownPct(38.4, true), shownPct(38.4, false)], [62, 38]);
});

done();
