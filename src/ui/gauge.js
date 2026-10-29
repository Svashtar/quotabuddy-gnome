// SPDX-License-Identifier: GPL-2.0-or-later
// SPDX-FileCopyrightText: 2026 Mitja Cebokli
// Generated with AI for personal use.
// Do NOT upload to extensions.gnome.org (EGO) unless you understand JavaScript
// and can maintain this code.

// A ring or a bar drawn with Cairo. The filled part uses the widget's CSS
// `color` (set per severity in stylesheet.css), the track the custom
// `-quotabuddy-track` colour, so themes and severities restyle it without code.

import GObject from 'gi://GObject';
import St from 'gi://St';
import Cairo from 'cairo';

const rgba = c => [c.red / 255, c.green / 255, c.blue / 255, c.alpha / 255];

export const Gauge = GObject.registerClass(
class QuotaBuddyGauge extends St.DrawingArea {
    // shape: 'ring' | 'bar'; thickness: share of the size, for rings
    _init({shape = 'ring', thickness = 0.16, style_class = '', ...params} = {}) {
        super._init({style_class: `quotabuddy-gauge ${style_class}`, ...params});
        this._shape = shape;
        this._thickness = thickness;
        this._fraction = 0;
        this._marker = null;
    }

    // fraction: 0–1 filled; marker: 0–1 tick (even-pace position) or null
    setValue(fraction, marker = null) {
        this._fraction = Math.min(1, Math.max(0, fraction));
        this._marker = marker === null ? null : Math.min(1, Math.max(0, marker));
        this.queue_repaint();
    }

    vfunc_repaint() {
        const cr = this.get_context();
        const [w, h] = this.get_surface_size();
        const node = this.get_theme_node();
        const fg = rgba(node.get_foreground_color());
        const [hasTrack, trackColor] = node.lookup_color('-quotabuddy-track', false);
        const track = hasTrack ? rgba(trackColor) : [fg[0], fg[1], fg[2], fg[3] * 0.22];
        cr.setLineCap(Cairo.LineCap.ROUND);
        if (this._shape === 'bar')
            this._drawBar(cr, w, h, fg, track);
        else
            this._drawRing(cr, w, h, fg, track);
        cr.$dispose();
    }

    _drawRing(cr, w, h, fg, track) {
        const size = Math.min(w, h);
        const line = Math.max(1.5, size * this._thickness);
        const r = size / 2 - line / 2;
        const cx = w / 2, cy = h / 2, top = -Math.PI / 2;
        cr.setLineWidth(line);
        cr.setSourceRGBA(...track);
        cr.arc(cx, cy, r, 0, 2 * Math.PI);
        cr.stroke();
        if (this._fraction > 0.004) {
            cr.setSourceRGBA(...fg);
            cr.arc(cx, cy, r, top, top + 2 * Math.PI * this._fraction);
            cr.stroke();
        }
        if (this._marker !== null) {
            // A short tick across the ring where an even pace would be.
            const a = top + 2 * Math.PI * this._marker;
            cr.setLineWidth(Math.max(1, line / 3));
            cr.setSourceRGBA(fg[0], fg[1], fg[2], fg[3] * 0.85);
            cr.moveTo(cx + Math.cos(a) * (r - line * 0.9), cy + Math.sin(a) * (r - line * 0.9));
            cr.lineTo(cx + Math.cos(a) * (r + line * 0.9), cy + Math.sin(a) * (r + line * 0.9));
            cr.stroke();
        }
    }

    _drawBar(cr, w, h, fg, track) {
        const line = h;
        const x0 = line / 2, x1 = w - line / 2, y = h / 2;
        cr.setLineWidth(line);
        cr.setSourceRGBA(...track);
        cr.moveTo(x0, y);
        cr.lineTo(x1, y);
        cr.stroke();
        if (this._fraction > 0.004) {
            cr.setSourceRGBA(...fg);
            cr.moveTo(x0, y);
            cr.lineTo(x0 + (x1 - x0) * this._fraction, y);
            cr.stroke();
        }
        if (this._marker !== null) {
            const x = x0 + (x1 - x0) * this._marker;
            cr.setLineWidth(Math.max(1, line / 3));
            cr.setSourceRGBA(fg[0], fg[1], fg[2], fg[3] * 0.85);
            cr.moveTo(x, 0);
            cr.lineTo(x, h);
            cr.stroke();
        }
    }
});
