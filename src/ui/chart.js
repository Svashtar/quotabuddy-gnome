// SPDX-License-Identifier: GPL-2.0-or-later
// SPDX-FileCopyrightText: 2026 Mitja Cebokli
// Generated with AI for personal use.
// Do NOT upload to extensions.gnome.org (EGO) unless you understand JavaScript
// and can maintain this code.

// Stacked column chart: one column per hour or day, one segment per model
// family. Colours come from FAMILY_COLORS so the legend can reuse them.

import GObject from 'gi://GObject';
import St from 'gi://St';

// Readable on light and dark panels; Opus uses Claude's own terracotta.
export const FAMILY_COLORS = {
    fable: [0.62, 0.48, 0.95],
    mythos: [0.80, 0.45, 0.85],
    opus: [0.85, 0.47, 0.34],
    sonnet: [0.36, 0.62, 0.95],
    haiku: [0.38, 0.78, 0.55],
    other: [0.60, 0.60, 0.65],
};

export const FAMILY_ORDER = ['fable', 'mythos', 'opus', 'sonnet', 'haiku', 'other'];

export const StackedChart = GObject.registerClass(
class QuotaBuddyStackedChart extends St.DrawingArea {
    _init(params = {}) {
        super._init({style_class: 'quotabuddy-chart', ...params});
        this._columns = [];
        this._highlight = -1;
    }

    // columns: [{segments: {family: value}}]; highlight: index drawn brighter (now)
    setData(columns, highlight = -1) {
        this._columns = columns;
        this._highlight = highlight;
        this.queue_repaint();
    }

    vfunc_repaint() {
        const cr = this.get_context();
        const [w, h] = this.get_surface_size();
        const n = this._columns.length;
        if (n) {
            const max = Math.max(...this._columns.map(c => Object.values(c.segments).reduce((s, v) => s + v, 0)), 1e-9);
            const gap = Math.max(1, Math.round(w / n * 0.25));
            const colW = (w - gap * (n - 1)) / n;
            const fg = this.get_theme_node().get_foreground_color();

            this._columns.forEach((col, i) => {
                const x = i * (colW + gap);
                // Empty slots still show a faint baseline, so gaps read as time.
                cr.setSourceRGBA(fg.red / 255, fg.green / 255, fg.blue / 255, 0.10);
                roundedRect(cr, x, h - 2, colW, 2, 1);
                cr.fill();

                let y = h;
                const dim = this._highlight >= 0 && i !== this._highlight ? 0.82 : 1;
                for (const family of FAMILY_ORDER) {
                    const v = col.segments[family];
                    if (!v)
                        continue;
                    const segH = Math.max(1, v / max * (h - 2));
                    const [r, g, b] = FAMILY_COLORS[family];
                    cr.setSourceRGBA(r, g, b, dim);
                    roundedRect(cr, x, y - segH, colW, segH, Math.min(2, colW / 3));
                    cr.fill();
                    y -= segH;
                }
            });
        }
        cr.$dispose();
    }
});

function roundedRect(cr, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    cr.newSubPath();
    cr.arc(x + w - r, y + r, r, -Math.PI / 2, 0);
    cr.arc(x + w - r, y + h - r, r, 0, Math.PI / 2);
    cr.arc(x + r, y + h - r, r, Math.PI / 2, Math.PI);
    cr.arc(x + r, y + r, r, Math.PI, 1.5 * Math.PI);
    cr.closePath();
}
