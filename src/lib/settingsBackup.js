// SPDX-License-Identifier: GPL-2.0-or-later
// SPDX-FileCopyrightText: 2026 Mitja Cebokli
// Generated with AI for personal use.
// Do NOT upload to extensions.gnome.org (EGO) unless you understand JavaScript
// and can maintain this code.

// Settings export/import. Pure so it can be unit tested.

export class BackupError extends Error {
    // reason: 'not-json' | 'not-backup' | 'newer' | 'invalid'; field: for 'invalid'
    constructor(reason, field = null) {
        super(field ? `${reason}: ${field}` : reason);
        this.name = 'BackupError';
        this.reason = reason;
        this.field = field;
    }
}

const BACKUP_FORMAT = 'quotabuddy-settings';
const BACKUP_VERSION = 1;

export const PANEL_FIGURES = ['session', 'week', 'model-week', 'reset', 'tokens-today', 'cost-today'];
export const POPUP_SECTIONS = ['pace', 'activity', 'cost', 'projects'];

const isSubset = all => v => Array.isArray(v) && v.every(s => all.includes(s));
const oneOf = all => v => all.includes(v);
const isBool = v => typeof v === 'boolean';

// [GSettings key, backup field, type check]. Direct mode is left out on
// purpose: turning it on needs the warning accepted on this computer.
const FIELDS = [
    ['panel-figures', 'panelFigures', isSubset(PANEL_FIGURES)],
    ['panel-style', 'panelStyle', oneOf(['rings-percent', 'bars-percent', 'rings', 'text'])],
    ['show-left', 'showLeft', isBool],
    ['pill-style', 'pillStyle', oneOf(['none', 'subtle', 'accent'])],
    ['popup-sections', 'popupSections', isSubset(POPUP_SECTIONS)],
    ['direct-interval', 'directInterval', v => Number.isInteger(v) && v >= 120 && v <= 1800],
    ['plan-override', 'planOverride', oneOf(['', 'pro', 'max-5x', 'max-20x', 'team', 'enterprise'])],
];

// values: {gsettingsKey: value}
export function buildBackup(values, extensionVersion) {
    const backup = {format: BACKUP_FORMAT, version: BACKUP_VERSION, extensionVersion};
    for (const [key, field] of FIELDS)
        backup[field] = values[key];
    return JSON.stringify(backup, null, 2);
}

// Returns {gsettingsKey: value} for the fields present in the file.
// Throws BackupError when the file is not a valid backup; prefs shows a
// translated message for its `reason`.
export function parseBackup(text) {
    let data;
    try {
        data = JSON.parse(text);
    } catch {
        throw new BackupError('not-json');
    }
    if (data?.format !== BACKUP_FORMAT)
        throw new BackupError('not-backup');
    if (data.version > BACKUP_VERSION)
        throw new BackupError('newer');

    const result = {};
    for (const [key, field, valid] of FIELDS) {
        if (!(field in data))
            continue;
        if (!valid(data[field]))
            throw new BackupError('invalid', field);
        result[key] = data[field];
    }
    return result;
}

export const BACKUP_KEYS = FIELDS.map(([key]) => key);
