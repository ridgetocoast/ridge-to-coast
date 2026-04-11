"""
test_visual_rendering.py — E2E tests for map layer visual properties.

Rather than pixel-level screenshot comparisons (which are fragile when
external CARTO tiles vary by network conditions), these tests inspect the
SVG attributes that Leaflet sets on rendered path/circle elements. This
validates that the STYLES constants in lib/geo-data.js are correctly
applied to each rendered layer — the actual colors, opacities, and stroke
weights visible on screen.

Approach:
  - Use page.evaluate() to call layer.getElement() on each Leaflet layer
    and read its SVG attributes (fill, stroke, fill-opacity, etc.)
  - These attributes are set directly by our JS constants and are
    deterministic regardless of tile loading or network state.
  - Hover behaviour is tested by firing Leaflet's 'mouseover' event and
    checking that fill-opacity increases to the hover value.

STYLES reference (from lib/geo-data.js):
  fallLine:    color '#e84393', weight 3, opacity 0.9, fill none
  coastal:     fillColor '#4682DC', fillOpacity 0.18, weight 0
  piedmont:    fillColor '#C88232', fillOpacity 0.18, weight 0
  regionHover: fillOpacity 0.32

City marker style (from map.js CITY_MARKER_STYLE):
  fillColor '#ffffff', color '#e84393', weight 2.5, fillOpacity 0.9
"""

import pytest

LAYER_TIMEOUT = 10_000

# ── Expected SVG attribute values ─────────────────────────────────────────────
# Must match STYLES in lib/geo-data.js and CITY_MARKER_STYLE in map.js exactly.
# Comparisons are case-insensitive (.lower()) since browsers may normalise case.

FALL_LINE_STROKE  = '#e84393'
FALL_LINE_WEIGHT  = 3
FALL_LINE_OPACITY = 0.9

COASTAL_FILL      = '#4682dc'
COASTAL_OPACITY   = 0.18

PIEDMONT_FILL     = '#c88232'
PIEDMONT_OPACITY  = 0.18

HOVER_OPACITY     = 0.32

CITY_FILL         = '#ffffff'
CITY_STROKE       = '#e84393'
CITY_FILL_OPACITY = 0.9


# ── Suite 1: Fall line visual properties ──────────────────────────────────────

def test_fall_line_stroke_color(page):
    """Fall line SVG path has the correct pink stroke color."""
    page.goto("/")
    page.wait_for_selector(".leaflet-overlay-pane path", timeout=LAYER_TIMEOUT)

    stroke = page.evaluate("""
        () => {
            let color = null;
            fallLineLayer.eachLayer(function(layer) {
                const el = layer.getElement();
                if (el) color = el.getAttribute('stroke');
            });
            return color;
        }
    """)
    assert stroke is not None, "Fall line layer produced no rendered SVG element"
    assert stroke.lower() == FALL_LINE_STROKE, \
        f"Expected stroke {FALL_LINE_STROKE!r}, got {stroke!r}"


def test_fall_line_stroke_weight(page):
    """Fall line SVG path stroke-width matches the configured weight (3)."""
    page.goto("/")
    page.wait_for_selector(".leaflet-overlay-pane path", timeout=LAYER_TIMEOUT)

    weight = page.evaluate("""
        () => {
            let w = null;
            fallLineLayer.eachLayer(function(layer) {
                const el = layer.getElement();
                if (el) w = el.getAttribute('stroke-width');
            });
            return w !== null ? parseFloat(w) : null;
        }
    """)
    assert weight is not None, "Fall line element has no stroke-width attribute"
    assert abs(weight - FALL_LINE_WEIGHT) < 0.01, \
        f"Expected stroke-width {FALL_LINE_WEIGHT}, got {weight}"


def test_fall_line_stroke_opacity(page):
    """Fall line SVG path stroke-opacity matches the configured opacity (0.9)."""
    page.goto("/")
    page.wait_for_selector(".leaflet-overlay-pane path", timeout=LAYER_TIMEOUT)

    opacity = page.evaluate("""
        () => {
            let op = null;
            fallLineLayer.eachLayer(function(layer) {
                const el = layer.getElement();
                if (el) op = el.getAttribute('stroke-opacity');
            });
            return op !== null ? parseFloat(op) : null;
        }
    """)
    assert opacity is not None, "Fall line element has no stroke-opacity attribute"
    assert abs(opacity - FALL_LINE_OPACITY) < 0.01, \
        f"Expected stroke-opacity {FALL_LINE_OPACITY}, got {opacity}"


def test_fall_line_has_no_fill(page):
    """Fall line SVG path fill is 'none' — it is a line, not a polygon."""
    page.goto("/")
    page.wait_for_selector(".leaflet-overlay-pane path", timeout=LAYER_TIMEOUT)

    fill = page.evaluate("""
        () => {
            let f = null;
            fallLineLayer.eachLayer(function(layer) {
                const el = layer.getElement();
                if (el) f = el.getAttribute('fill');
            });
            return f;
        }
    """)
    assert fill == 'none', \
        f"Fall line should have fill='none' (it is a line), got {fill!r}"


# ── Suite 2: Coastal Plain visual properties ──────────────────────────────────

def test_coastal_plain_fill_color(page):
    """Coastal Plain polygon has the correct blue fill color (#4682DC)."""
    page.goto("/")
    page.wait_for_selector(".leaflet-overlay-pane path", timeout=LAYER_TIMEOUT)

    fill = page.evaluate("""
        () => {
            let color = null;
            coastalLayer.eachLayer(function(layer) {
                const el = layer.getElement();
                if (el) color = el.getAttribute('fill');
            });
            return color;
        }
    """)
    assert fill is not None, "Coastal layer produced no rendered SVG element"
    assert fill.lower() == COASTAL_FILL, \
        f"Expected fill {COASTAL_FILL!r}, got {fill!r}"


def test_coastal_plain_fill_opacity(page):
    """Coastal Plain polygon fill-opacity is 0.18 (semi-transparent)."""
    page.goto("/")
    page.wait_for_selector(".leaflet-overlay-pane path", timeout=LAYER_TIMEOUT)

    opacity = page.evaluate("""
        () => {
            let op = null;
            coastalLayer.eachLayer(function(layer) {
                const el = layer.getElement();
                if (el) op = el.getAttribute('fill-opacity');
            });
            return op !== null ? parseFloat(op) : null;
        }
    """)
    assert opacity is not None, "Coastal layer element has no fill-opacity attribute"
    assert abs(opacity - COASTAL_OPACITY) < 0.01, \
        f"Expected fill-opacity {COASTAL_OPACITY}, got {opacity}"


def test_coastal_hover_increases_opacity(page):
    """Hovering the Coastal Plain polygon raises fill-opacity to 0.32."""
    page.goto("/")
    page.wait_for_selector(".leaflet-overlay-pane path", timeout=LAYER_TIMEOUT)

    result = page.evaluate("""
        () => {
            let before = null, after = null;
            coastalLayer.eachLayer(function(layer) {
                const el = layer.getElement();
                if (el) before = parseFloat(el.getAttribute('fill-opacity'));
            });
            // Fire Leaflet's mouseover event to trigger the hover style
            coastalLayer.eachLayer(function(layer) {
                layer.fire('mouseover');
            });
            coastalLayer.eachLayer(function(layer) {
                const el = layer.getElement();
                if (el) after = parseFloat(el.getAttribute('fill-opacity'));
            });
            return { before, after };
        }
    """)
    assert result['before'] is not None
    assert result['after'] is not None
    assert abs(result['before'] - COASTAL_OPACITY) < 0.01, \
        f"Pre-hover opacity should be {COASTAL_OPACITY}, got {result['before']}"
    assert abs(result['after'] - HOVER_OPACITY) < 0.01, \
        f"Post-hover opacity should be {HOVER_OPACITY}, got {result['after']}"


def test_coastal_mouseout_restores_opacity(page):
    """Mouse-out after hovering restores Coastal Plain fill-opacity to 0.18."""
    page.goto("/")
    page.wait_for_selector(".leaflet-overlay-pane path", timeout=LAYER_TIMEOUT)

    opacity = page.evaluate("""
        () => {
            coastalLayer.eachLayer(function(layer) {
                layer.fire('mouseover');
            });
            coastalLayer.eachLayer(function(layer) {
                layer.fire('mouseout');
            });
            let op = null;
            coastalLayer.eachLayer(function(layer) {
                const el = layer.getElement();
                if (el) op = parseFloat(el.getAttribute('fill-opacity'));
            });
            return op;
        }
    """)
    assert opacity is not None
    assert abs(opacity - COASTAL_OPACITY) < 0.01, \
        f"After mouseout fill-opacity should return to {COASTAL_OPACITY}, got {opacity}"


# ── Suite 3: Piedmont visual properties ───────────────────────────────────────

def test_piedmont_fill_color(page):
    """Piedmont polygon has the correct orange-brown fill color (#C88232)."""
    page.goto("/")
    page.wait_for_selector(".leaflet-overlay-pane path", timeout=LAYER_TIMEOUT)

    fill = page.evaluate("""
        () => {
            let color = null;
            piedmontLayer.eachLayer(function(layer) {
                const el = layer.getElement();
                if (el) color = el.getAttribute('fill');
            });
            return color;
        }
    """)
    assert fill is not None, "Piedmont layer produced no rendered SVG element"
    assert fill.lower() == PIEDMONT_FILL, \
        f"Expected fill {PIEDMONT_FILL!r}, got {fill!r}"


def test_piedmont_fill_opacity(page):
    """Piedmont polygon fill-opacity is 0.18 (semi-transparent)."""
    page.goto("/")
    page.wait_for_selector(".leaflet-overlay-pane path", timeout=LAYER_TIMEOUT)

    opacity = page.evaluate("""
        () => {
            let op = null;
            piedmontLayer.eachLayer(function(layer) {
                const el = layer.getElement();
                if (el) op = el.getAttribute('fill-opacity');
            });
            return op !== null ? parseFloat(op) : null;
        }
    """)
    assert opacity is not None
    assert abs(opacity - PIEDMONT_OPACITY) < 0.01, \
        f"Expected fill-opacity {PIEDMONT_OPACITY}, got {opacity}"


def test_piedmont_hover_increases_opacity(page):
    """Hovering the Piedmont polygon raises fill-opacity to 0.32."""
    page.goto("/")
    page.wait_for_selector(".leaflet-overlay-pane path", timeout=LAYER_TIMEOUT)

    result = page.evaluate("""
        () => {
            let before = null, after = null;
            piedmontLayer.eachLayer(function(layer) {
                const el = layer.getElement();
                if (el) before = parseFloat(el.getAttribute('fill-opacity'));
            });
            piedmontLayer.eachLayer(function(layer) {
                layer.fire('mouseover');
            });
            piedmontLayer.eachLayer(function(layer) {
                const el = layer.getElement();
                if (el) after = parseFloat(el.getAttribute('fill-opacity'));
            });
            return { before, after };
        }
    """)
    assert abs(result['before'] - PIEDMONT_OPACITY) < 0.01
    assert abs(result['after'] - HOVER_OPACITY) < 0.01, \
        f"Post-hover opacity should be {HOVER_OPACITY}, got {result['after']}"


# ── Suite 4: Region color contrast ────────────────────────────────────────────

def test_coastal_and_piedmont_have_different_fills(page):
    """Coastal Plain and Piedmont use visually distinct fill colors."""
    page.goto("/")
    page.wait_for_selector(".leaflet-overlay-pane path", timeout=LAYER_TIMEOUT)

    colors = page.evaluate("""
        () => {
            let coastal = null, piedmont = null;
            coastalLayer.eachLayer(function(layer) {
                const el = layer.getElement();
                if (el) coastal = el.getAttribute('fill');
            });
            piedmontLayer.eachLayer(function(layer) {
                const el = layer.getElement();
                if (el) piedmont = el.getAttribute('fill');
            });
            return { coastal, piedmont };
        }
    """)
    assert colors['coastal'] is not None and colors['piedmont'] is not None
    assert colors['coastal'].lower() != colors['piedmont'].lower(), \
        f"Coastal and Piedmont should have different fills, both were {colors['coastal']!r}"


def test_fall_line_stroke_differs_from_region_fills(page):
    """Fall line stroke color is distinct from both region fill colors."""
    page.goto("/")
    page.wait_for_selector(".leaflet-overlay-pane path", timeout=LAYER_TIMEOUT)

    colors = page.evaluate("""
        () => {
            let fallLine = null, coastal = null;
            fallLineLayer.eachLayer(function(layer) {
                const el = layer.getElement();
                if (el) fallLine = el.getAttribute('stroke');
            });
            coastalLayer.eachLayer(function(layer) {
                const el = layer.getElement();
                if (el) coastal = el.getAttribute('fill');
            });
            return { fallLine, coastal };
        }
    """)
    # Fall line pink (#e84393) is used as the city marker stroke too,
    # but should not match the blue coastal fill.
    assert colors['fallLine'].lower() != colors['coastal'].lower(), \
        "Fall line stroke should differ from Coastal Plain fill"


# ── Suite 5: City marker visual properties ────────────────────────────────────

def test_city_markers_have_white_fill(page):
    """City marker circles have white fill (#ffffff)."""
    page.goto("/")
    page.wait_for_selector(".leaflet-overlay-pane path", timeout=LAYER_TIMEOUT)

    fill = page.evaluate("""
        () => {
            let f = null;
            cityMarkersLayer.eachLayer(function(layer) {
                const el = layer.getElement();
                if (el && f === null) f = el.getAttribute('fill');
            });
            return f;
        }
    """)
    assert fill is not None, "City markers layer has no rendered elements"
    assert fill.lower() == CITY_FILL, \
        f"Expected city marker fill {CITY_FILL!r}, got {fill!r}"


def test_city_markers_have_pink_stroke(page):
    """City marker circles have pink stroke (#e84393) matching the fall line."""
    page.goto("/")
    page.wait_for_selector(".leaflet-overlay-pane path", timeout=LAYER_TIMEOUT)

    stroke = page.evaluate("""
        () => {
            let s = null;
            cityMarkersLayer.eachLayer(function(layer) {
                const el = layer.getElement();
                if (el && s === null) s = el.getAttribute('stroke');
            });
            return s;
        }
    """)
    assert stroke is not None
    assert stroke.lower() == CITY_STROKE, \
        f"Expected city marker stroke {CITY_STROKE!r}, got {stroke!r}"


def test_city_markers_high_fill_opacity(page):
    """City markers have high fill-opacity (0.9) so they are clearly visible."""
    page.goto("/")
    page.wait_for_selector(".leaflet-overlay-pane path", timeout=LAYER_TIMEOUT)

    opacity = page.evaluate("""
        () => {
            let op = null;
            cityMarkersLayer.eachLayer(function(layer) {
                const el = layer.getElement();
                if (el && op === null) op = el.getAttribute('fill-opacity');
            });
            return op !== null ? parseFloat(op) : null;
        }
    """)
    assert opacity is not None
    assert abs(opacity - CITY_FILL_OPACITY) < 0.01, \
        f"Expected city marker fill-opacity {CITY_FILL_OPACITY}, got {opacity}"


def test_city_marker_count_matches_cities_data(page):
    """Number of rendered city markers equals the length of FALL_LINE_CITIES."""
    page.goto("/")
    page.wait_for_selector(".leaflet-overlay-pane path", timeout=LAYER_TIMEOUT)

    result = page.evaluate("""
        () => {
            let rendered = 0;
            cityMarkersLayer.eachLayer(function() { rendered++; });
            const defined = window.GeoData.FALL_LINE_CITIES.length;
            return { rendered, defined };
        }
    """)
    assert result['rendered'] == result['defined'], (
        f"Expected {result['defined']} city markers (one per FALL_LINE_CITIES entry), "
        f"got {result['rendered']} rendered"
    )


# ── Suite 6: Toggle visual effect ─────────────────────────────────────────────

def test_regions_toggle_off_removes_filled_paths(page):
    """Unchecking regions toggle removes fill paths from the SVG overlay."""
    page.goto("/")
    page.wait_for_selector(".leaflet-overlay-pane path", timeout=LAYER_TIMEOUT)

    count_before = page.evaluate("""
        () => document.querySelectorAll(
            '.leaflet-overlay-pane [fill]:not([fill="none"])'
        ).length
    """)

    page.locator("#toggle-regions").uncheck()
    page.wait_for_timeout(300)

    count_after = page.evaluate("""
        () => document.querySelectorAll(
            '.leaflet-overlay-pane [fill]:not([fill="none"])'
        ).length
    """)
    assert count_after < count_before, (
        f"Expected fewer filled elements after regions toggle off "
        f"(before={count_before}, after={count_after})"
    )


def test_fall_line_toggle_off_removes_stroke_path(page):
    """Unchecking fall line toggle removes it from the Leaflet map."""
    page.goto("/")
    page.wait_for_selector(".leaflet-overlay-pane path", timeout=LAYER_TIMEOUT)

    # Verify fall line is on the map before toggling
    before = page.evaluate("() => map.hasLayer(fallLineLayer)")
    assert before, "Fall line should be on map before toggle"

    page.locator("#toggle-fallline").uncheck()
    page.wait_for_timeout(300)

    # map.hasLayer() is the authoritative Leaflet check — getElement() caches
    # the DOM element reference even after removal, so it cannot be used here.
    after = page.evaluate("() => map.hasLayer(fallLineLayer)")
    assert not after, "Fall line should no longer be on map after toggle off"
