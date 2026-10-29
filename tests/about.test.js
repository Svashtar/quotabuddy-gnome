import {test, assertEqual, assertThrows, done} from './harness.js';
import {escapeMarkup} from '../src/lib/markdown.js';
import {buildBackup, parseBackup} from '../src/lib/settingsBackup.js';
import {formatDebugInfo, formatGjsVersion} from '../src/lib/debugInfo.js';
import {install, uninstall, isInstalled, bridgeCommand, compactLine, bridgeRecord} from '../src/lib/statusLineSetup.js';

test('escapes Pango markup', () => {
    assertEqual(escapeMarkup('<a & "b">'), '&lt;a &amp; &quot;b&quot;&gt;');
});

const VALUES = {
    'panel-figures': ['session', 'week'],
    'panel-style': 'rings-percent',
    'show-left': true,
    'pill-style': 'subtle',
    'popup-sections': ['pace', 'activity', 'cost', 'projects'],
    'direct-interval': 300,
    'plan-override': '',
};

test('backup round-trip keeps every value', () => {
    assertEqual(parseBackup(buildBackup(VALUES, '0.1.0')), VALUES);
});

test('backup rejects foreign and invalid files', () => {
    assertThrows(() => parseBackup('nope'), /not-json/);
    assertThrows(() => parseBackup('{"format":"traybuddy-settings"}'), /not-backup/);
    assertThrows(() => parseBackup('{"format":"quotabuddy-settings","version":99}'), /newer/);
    assertThrows(() => parseBackup('{"format":"quotabuddy-settings","version":1,"panelFigures":["x"]}'), /panelFigures/);
    assertThrows(() => parseBackup('{"format":"quotabuddy-settings","version":1,"directInterval":5}'), /directInterval/);
});

test('debug info has no paths or figures', () => {
    const text = formatDebugInfo({
        extensionVersion: '0.1.0', shellVersion: '51.1', gjsVersion: '1.88.1', os: 'Test', sessionType: 'wayland', now: 3600e3,
        settings: {panelFigures: ['session'], panelStyle: 'rings', showLeft: true, pillStyle: 'subtle', popupSections: [],
                   directMode: false, directInterval: 300, planOverride: ''},
        plan: 'Max 5×', bridgeInstalled: true, sources: {statusline: 0, direct: 0, logs: 1800e3}, windows: ['session'], historyDays: 3,
    });
    assertEqual(text.includes('Status-line bridge: installed, last reading never'), true);
    assertEqual(text.includes('Log scan: last 30m ago, 3 days'), true);
    assertEqual(formatGjsVersion('18801'), '1.88.1');
});

test('status line install keeps and restores the previous one', () => {
    const cmd = bridgeCommand("/home/me/.local/share/gnome-shell/extensions/quotabuddy@svashta.com");
    const before = {model: 'opus', statusLine: {type: 'command', command: 'mine.sh', padding: 1}};
    const {settings, previous} = install(before, cmd);
    assertEqual(isInstalled(settings), true);
    assertEqual(settings.statusLine.padding, 1);
    assertEqual(settings.model, 'opus');
    assertEqual(previous, before.statusLine);
    assertEqual(install(settings, cmd).previous, null);
    assertEqual(uninstall(settings, previous), before);
    assertEqual(uninstall({statusLine: {command: cmd}}, null), {});
    assertEqual(uninstall(before, null), before);
});

test('bridge quotes paths with apostrophes', () => {
    assertEqual(bridgeCommand("/a'b"), "gjs -m '/a'\\''b/bridge/statusline.js'");
});

test('bridge line and record', () => {
    const input = {model: {id: 'claude-opus-5-5', display_name: 'Opus 5.5'}, cwd: '/secret',
                   rate_limits: {five_hour: {used_percentage: 38.4, resets_at: 1}, seven_day: {used_percentage: 61, resets_at: 2}}};
    assertEqual(compactLine(input), 'Opus 5.5 · 5h 38 % · week 61 %');
    assertEqual(bridgeRecord(input, 9), {updatedAt: 9, model: 'claude-opus-5-5',
                                         rateLimits: {five_hour: {used_percentage: 38.4, resets_at: 1}, seven_day: {used_percentage: 61, resets_at: 2}}});
    assertEqual(bridgeRecord({model: {}}, 9), null);
});

done();
