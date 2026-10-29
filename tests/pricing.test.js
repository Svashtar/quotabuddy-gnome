import {test, assertEqual, done} from './harness.js';
import {priceFor, costUsd, modelLabel, modelFamily} from '../src/lib/pricing.js';
import {planId, planInfo} from '../src/lib/plan.js';

test('prices: exact, dated ids and family fallback', () => {
    assertEqual(priceFor('claude-opus-5-5').input, 4);
    assertEqual(priceFor('claude-opus-5').input, 5);
    assertEqual(priceFor('claude-haiku-4-5-20251001').output, 5);
    assertEqual(priceFor('claude-fable-5-1').cacheRead, 0.25);
    assertEqual(priceFor('claude-fable-5').cacheRead, 1);
    assertEqual(priceFor('claude-sonnet-9').input, 2);
    assertEqual(priceFor('gpt-5'), null);
});

test('cost includes cache writes by TTL', () => {
    const u = {input: 1e6, output: 1e6, cacheRead: 1e6, cacheWrite5m: 1e6, cacheWrite1h: 1e6};
    assertEqual(costUsd('claude-opus-5-5', u), 4 + 20 + 0.2 + 5 + 8);
    assertEqual(costUsd('unknown', u), 0);
});

test('model labels and families', () => {
    assertEqual(modelLabel('claude-opus-5-5'), 'Opus 5.5');
    assertEqual(modelLabel('claude-haiku-4-5-20251001'), 'Haiku 4.5');
    assertEqual(modelLabel('claude-fable-5'), 'Fable 5');
    assertEqual(modelLabel('mystery'), 'mystery');
    assertEqual(modelFamily('claude-sonnet-5-5'), 'sonnet');
    assertEqual(modelFamily('x'), 'other');
});

test('plan from credentials fields', () => {
    assertEqual(planId('max', 'default_claude_max_5x'), 'max-5x');
    assertEqual(planId('max', 'default_claude_max_20x'), 'max-20x');
    assertEqual(planId('pro', null), 'pro');
    assertEqual(planId(null, null), null);
    assertEqual(planInfo('max-5x').label, 'Max 5×');
});

done();
