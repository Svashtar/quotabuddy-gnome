import {test, assertEqual, done} from './harness.js';
import {parseLine} from '../src/lib/logParser.js';

const line = o => JSON.stringify({type: 'assistant', timestamp: '2026-10-29T10:00:00Z', cwd: '/p/x', sessionId: 's1', requestId: 'r1', ...o});

test('parses usage with the 1-hour cache split', () => {
    const e = parseLine(line({message: {id: 'm1', model: 'claude-opus-5-5', usage: {
        input_tokens: 5, output_tokens: 100, cache_read_input_tokens: 1000, cache_creation_input_tokens: 300,
        cache_creation: {ephemeral_5m_input_tokens: 100, ephemeral_1h_input_tokens: 200}}}}));
    assertEqual(e, {id: 'm1:r1', time: Date.parse('2026-10-29T10:00:00Z'), model: 'claude-opus-5-5', project: '/p/x', sessionId: 's1',
                    usage: {input: 5, output: 100, cacheRead: 1000, cacheWrite5m: 100, cacheWrite1h: 200}});
});

test('older lines count cache writes as 5-minute', () => {
    const e = parseLine(line({message: {id: 'm', model: 'claude-sonnet-4-6', usage: {input_tokens: 1, output_tokens: 1, cache_creation_input_tokens: 50}}}));
    assertEqual([e.usage.cacheWrite5m, e.usage.cacheWrite1h], [50, 0]);
});

test('skips synthetic replies, users, broken JSON and bad times', () => {
    assertEqual(parseLine(line({message: {model: '<synthetic>', usage: {}}})), null);
    assertEqual(parseLine(JSON.stringify({type: 'user', message: {usage: {}, role: 'assistant'}})), null);
    assertEqual(parseLine('{"type":"assistant","usage"'), null);
    assertEqual(parseLine(line({timestamp: 'nope', message: {model: 'claude-opus-5', usage: {}}})), null);
    assertEqual(parseLine('{"type":"summary"}'), null);
});

done();
