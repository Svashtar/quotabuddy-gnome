// SPDX-License-Identifier: GPL-2.0-or-later
// SPDX-FileCopyrightText: 2026 Mitja Cebokli
// Generated with AI for personal use.
// Do NOT upload to extensions.gnome.org (EGO) unless you understand JavaScript
// and can maintain this code.

// The Cairo drawing behind Gauge, kept free of St so it can be rendered to
// an image outside the shell to check how it looks.
//
// Colours are [r, g, b, a] in 0–1. The pace marker has its own colour
// (white, dark in light mode), so it reads on the fill and the track and
// doesn't look like part of the fill.

import Cairo from 'cairo';

function strokeMarker(cr, from, to, width, color) {
    cr.setLineCap(Cairo.LineCap.ROUND);
    cr.setLineWidth(width);
    cr.setSourceRGBA(...color);
    cr.moveTo(...from);
    cr.lineTo(...to);
    cr.stroke();
}

// Room the marker needs outside the ring, so it isn't clipped at the edge.
function markerOverhang(line) {
    return line * 0.45;
}

// thickness: share of the size; markerRoom: leave space for a marker even
// when there is none now, so rings with and without one are the same size.
export function drawRing(cr, w, h, {fraction, marker = null, thickness, fg, track, markerColor, markerRoom = false}) {
    const size = Math.min(w, h);
    const line = Math.max(1.5, size * thickness);
    const inset = markerRoom || marker !== null ? markerOverhang(line) : 0;
    const r = size / 2 - line / 2 - inset;
    const cx = w / 2, cy = h / 2, top = -Math.PI / 2;
    cr.newPath();
    cr.setLineCap(Cairo.LineCap.ROUND);
    cr.setLineWidth(line);
    cr.setSourceRGBA(...track);
    cr.arc(cx, cy, r, 0, 2 * Math.PI);
    cr.stroke();
    if (fraction > 0.004) {
        cr.setSourceRGBA(...fg);
        cr.arc(cx, cy, r, top, top + 2 * Math.PI * fraction);
        cr.stroke();
    }
    if (marker !== null) {
        // A short tick across the ring where an even pace would be.
        const a = top + 2 * Math.PI * marker;
        const reach = line / 2 + markerOverhang(line) - 1;
        const at = d => [cx + Math.cos(a) * (r + d), cy + Math.sin(a) * (r + d)];
        strokeMarker(cr, at(-reach), at(reach), Math.max(2, line / 3), markerColor);
    }
}

export function drawBar(cr, w, h, {fraction, marker = null, fg, track, markerColor}) {
    const line = h;
    const x0 = line / 2, x1 = w - line / 2, y = h / 2;
    cr.setLineCap(Cairo.LineCap.ROUND);
    cr.setLineWidth(line);
    cr.setSourceRGBA(...track);
    cr.moveTo(x0, y);
    cr.lineTo(x1, y);
    cr.stroke();
    if (fraction > 0.004) {
        cr.setSourceRGBA(...fg);
        cr.moveTo(x0, y);
        cr.lineTo(x0 + (x1 - x0) * fraction, y);
        cr.stroke();
    }
    if (marker !== null) {
        const x = x0 + (x1 - x0) * marker;
        strokeMarker(cr, [x, 1], [x, h - 1], Math.max(1, line / 3), markerColor);
    }
}
