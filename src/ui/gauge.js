// SPDX-License-Identifier: GPL-2.0-or-later
// SPDX-FileCopyrightText: 2026 Mitja Cebokli
// Generated with AI for personal use.
// Do NOT upload to extensions.gnome.org (EGO) unless you understand JavaScript
// and can maintain this code.

// A ring or a bar (drawn in gaugeDraw.js). The filled part uses the widget's
// CSS `color` (set per severity in stylesheet.css), the track the custom
// `-quotabuddy-track` colour and the pace marker `-quotabuddy-marker`, so
// themes and severities restyle it without code.

import GObject from 'gi://GObject';
import St from 'gi://St';
import {drawRing, drawBar} from './gaugeDraw.js';

const rgba = c => [c.red / 255, c.green / 255, c.blue / 255, c.alpha / 255];

export const Gauge = GObject.registerClass(
class QuotaBuddyGauge extends St.DrawingArea {
    // shape: 'ring' | 'bar'; thickness: share of the size, for rings
    // markerRoom: keep space for the pace marker so rings line up with or without one
    _init({shape = 'ring', thickness = 0.16, markerRoom = false, style_class = '', ...params} = {}) {
        super._init({style_class: `quotabuddy-gauge ${style_class}`, ...params});
        this._shape = shape;
        this._thickness = thickness;
        this._markerRoom = markerRoom;
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
        const [hasMarker, markerColor] = node.lookup_color('-quotabuddy-marker', false);
        const params = {
            fraction: this._fraction,
            marker: this._marker,
            thickness: this._thickness,
            markerRoom: this._markerRoom,
            fg,
            track,
            markerColor: hasMarker ? rgba(markerColor) : [1, 1, 1, 1],
        };
        if (this._shape === 'bar')
            drawBar(cr, w, h, params);
        else
            drawRing(cr, w, h, params);
        cr.$dispose();
    }
});
