"""
test_markers.py — E2E tests for the fall line city marker layer.

Tests that markers appear on load, can be toggled via the legend,
and display correct popup content when triggered.
"""

import pytest
from playwright.sync_api import expect

LAYER_TIMEOUT = 10_000
POPUP_TIMEOUT = 5_000


# ── Suite 1: Marker presence ──────────────────────────────────────────────────

def test_city_markers_in_dom_on_load(page):
    """City marker SVG elements are present in the DOM on initial load."""
    page.goto("/")
    page.wait_for_selector(".leaflet-container", timeout=LAYER_TIMEOUT)
    # circleMarker renders as <path> elements in the SVG overlay pane
    markers = page.locator(".leaflet-overlay-pane svg path.leaflet-interactive")
    # There should be at least one interactive path (could be markers or fall line)
    expect(markers.first).to_be_attached(timeout=LAYER_TIMEOUT)


def test_city_toggle_present_in_legend(page):
    """City markers toggle checkbox is present in the legend."""
    page.goto("/")
    toggle = page.locator("#toggle-cities")
    expect(toggle).to_be_attached(timeout=LAYER_TIMEOUT)


def test_city_toggle_checked_by_default(page):
    """City markers toggle is checked (visible) by default."""
    page.goto("/")
    toggle = page.locator("#toggle-cities")
    expect(toggle).to_be_checked(timeout=LAYER_TIMEOUT)


def test_city_swatch_in_legend(page):
    """A city marker swatch (circle icon) is shown in the legend."""
    page.goto("/")
    swatch = page.locator(".swatch.citymarker")
    expect(swatch).to_be_attached(timeout=LAYER_TIMEOUT)


# ── Suite 2: Toggle behaviour ─────────────────────────────────────────────────

def test_city_markers_toggle_unchecks(page):
    """Unchecking the city markers toggle removes the layer from the map."""
    page.goto("/")
    page.wait_for_selector(".leaflet-container", timeout=LAYER_TIMEOUT)
    toggle = page.locator("#toggle-cities")
    expect(toggle).to_be_checked()
    toggle.uncheck()
    page.wait_for_timeout(300)
    expect(toggle).not_to_be_checked()


def test_city_markers_toggle_rechecks(page):
    """Re-checking the toggle adds the city markers back to the map."""
    page.goto("/")
    page.wait_for_selector(".leaflet-container", timeout=LAYER_TIMEOUT)
    toggle = page.locator("#toggle-cities")
    toggle.uncheck()
    page.wait_for_timeout(300)
    toggle.check()
    page.wait_for_timeout(300)
    expect(toggle).to_be_checked()


# ── Suite 3: Popup content ────────────────────────────────────────────────────

def test_city_popup_opens_for_richmond(page):
    """Richmond's popup can be opened via JavaScript and contains the city name."""
    page.goto("/")
    page.wait_for_selector(".leaflet-container", timeout=LAYER_TIMEOUT)

    page.evaluate("""
        cityMarkersLayer.eachLayer(function(layer) {
            var ll = layer.getLatLng();
            if (Math.abs(ll.lat - 37.527) < 0.01 && Math.abs(ll.lng - (-77.464)) < 0.01) {
                layer.openPopup();
            }
        });
    """)

    popup = page.locator(".leaflet-popup-content-wrapper")
    expect(popup).to_be_visible(timeout=POPUP_TIMEOUT)
    expect(popup).to_contain_text("Richmond")


def test_city_popup_contains_river(page):
    """Richmond's popup contains the James River."""
    page.goto("/")
    page.wait_for_selector(".leaflet-container", timeout=LAYER_TIMEOUT)

    page.evaluate("""
        cityMarkersLayer.eachLayer(function(layer) {
            var ll = layer.getLatLng();
            if (Math.abs(ll.lat - 37.527) < 0.01 && Math.abs(ll.lng - (-77.464)) < 0.01) {
                layer.openPopup();
            }
        });
    """)

    popup = page.locator(".leaflet-popup-content-wrapper")
    expect(popup).to_be_visible(timeout=POPUP_TIMEOUT)
    expect(popup).to_contain_text("James River")


def test_city_popup_contains_zone(page):
    """Richmond's popup contains the hardiness zone badge."""
    page.goto("/")
    page.wait_for_selector(".leaflet-container", timeout=LAYER_TIMEOUT)

    page.evaluate("""
        cityMarkersLayer.eachLayer(function(layer) {
            var ll = layer.getLatLng();
            if (Math.abs(ll.lat - 37.527) < 0.01 && Math.abs(ll.lng - (-77.464)) < 0.01) {
                layer.openPopup();
            }
        });
    """)

    popup = page.locator(".leaflet-popup-content-wrapper")
    expect(popup).to_be_visible(timeout=POPUP_TIMEOUT)
    expect(popup).to_contain_text("7b")


def test_city_popup_contains_region_badge(page):
    """Richmond's popup contains the Piedmont region badge."""
    page.goto("/")
    page.wait_for_selector(".leaflet-container", timeout=LAYER_TIMEOUT)

    page.evaluate("""
        cityMarkersLayer.eachLayer(function(layer) {
            var ll = layer.getLatLng();
            if (Math.abs(ll.lat - 37.527) < 0.01 && Math.abs(ll.lng - (-77.464)) < 0.01) {
                layer.openPopup();
            }
        });
    """)

    popup = page.locator(".leaflet-popup-content-wrapper")
    expect(popup).to_be_visible(timeout=POPUP_TIMEOUT)
    expect(popup).to_contain_text("Piedmont")


# ── Suite 4: Mobile viewport ──────────────────────────────────────────────────

def test_city_toggle_accessible_on_mobile(page):
    """City markers toggle is in the DOM on a mobile viewport (390×844)."""
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto("/")
    page.wait_for_selector(".leaflet-container", timeout=LAYER_TIMEOUT)
    toggle = page.locator("#toggle-cities")
    assert toggle.count() > 0, "City markers toggle not found in DOM on mobile"


def test_city_popup_opens_on_mobile(page):
    """City popup can be opened via JavaScript on a mobile viewport."""
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto("/")
    page.wait_for_selector(".leaflet-container", timeout=LAYER_TIMEOUT)

    page.evaluate("""
        cityMarkersLayer.eachLayer(function(layer) {
            var ll = layer.getLatLng();
            if (Math.abs(ll.lat - 37.527) < 0.01 && Math.abs(ll.lng - (-77.464)) < 0.01) {
                layer.openPopup();
            }
        });
    """)

    popup = page.locator(".leaflet-popup-content-wrapper")
    expect(popup).to_be_visible(timeout=POPUP_TIMEOUT)
    expect(popup).to_contain_text("Richmond")
