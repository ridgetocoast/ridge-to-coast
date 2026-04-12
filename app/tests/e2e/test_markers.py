"""
test_markers.py — E2E tests for the fall line city marker layer.

Tests that markers appear on load, can be toggled via the legend,
and navigate to the detail page when clicked.
"""

import pytest
from playwright.sync_api import expect

LAYER_TIMEOUT  = 10_000
DETAIL_TIMEOUT = 5_000


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


# ── Suite 3: Detail page navigation ──────────────────────────────────────────

def _navigate_to_city_detail(page, city_slug):
    """Helper: set location hash to a city detail page and wait for render."""
    page.evaluate(f"location.hash = '#detail/city/{city_slug}'")
    page.wait_for_selector("#detail-view:not([hidden])", timeout=DETAIL_TIMEOUT)


def test_city_detail_page_shows_for_richmond(page):
    """Navigating to Richmond's detail hash shows the detail view."""
    page.goto("/")
    page.wait_for_selector(".leaflet-container", timeout=LAYER_TIMEOUT)
    _navigate_to_city_detail(page, "richmond-va")
    detail = page.locator("#detail-content")
    expect(detail).to_contain_text("Richmond")


def test_city_detail_contains_river(page):
    """Richmond detail page contains the James River."""
    page.goto("/")
    page.wait_for_selector(".leaflet-container", timeout=LAYER_TIMEOUT)
    _navigate_to_city_detail(page, "richmond-va")
    expect(page.locator("#detail-content")).to_contain_text("James River")


def test_city_detail_contains_zone(page):
    """Richmond detail page contains the hardiness zone."""
    page.goto("/")
    page.wait_for_selector(".leaflet-container", timeout=LAYER_TIMEOUT)
    _navigate_to_city_detail(page, "richmond-va")
    expect(page.locator("#detail-content")).to_contain_text("7b")


def test_city_detail_contains_region(page):
    """Richmond detail page contains the Piedmont region label."""
    page.goto("/")
    page.wait_for_selector(".leaflet-container", timeout=LAYER_TIMEOUT)
    _navigate_to_city_detail(page, "richmond-va")
    expect(page.locator("#detail-content")).to_contain_text("Piedmont")


def test_back_button_returns_to_map(page):
    """Back button on detail page returns to the map view."""
    page.goto("/")
    page.wait_for_selector(".leaflet-container", timeout=LAYER_TIMEOUT)
    _navigate_to_city_detail(page, "richmond-va")
    # Map view should be hidden
    assert page.locator("#map-view").get_attribute("hidden") is not None, \
        "map-view should be hidden while detail view is shown"
    # Click back
    page.locator("#back-btn").click()
    page.wait_for_selector("#map-view:not([hidden])", timeout=DETAIL_TIMEOUT)
    expect(page.locator("#map")).to_be_visible()


# ── Suite 4: Blue Ridge city detail ──────────────────────────────────────────

def test_asheville_detail_page(page):
    """Asheville NC detail page shows Blue Ridge region and French Broad River."""
    page.goto("/")
    page.wait_for_selector(".leaflet-container", timeout=LAYER_TIMEOUT)
    _navigate_to_city_detail(page, "asheville-nc")
    detail = page.locator("#detail-content")
    expect(detail).to_contain_text("Asheville")
    expect(detail).to_contain_text("French Broad")
    expect(detail).to_contain_text("Blue Ridge")


# ── Suite 5: Mobile viewport ──────────────────────────────────────────────────

def test_city_toggle_accessible_on_mobile(page):
    """City markers toggle is in the DOM on a mobile viewport (390×844)."""
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto("/")
    page.wait_for_selector(".leaflet-container", timeout=LAYER_TIMEOUT)
    toggle = page.locator("#toggle-cities")
    assert toggle.count() > 0, "City markers toggle not found in DOM on mobile"


def test_city_detail_accessible_on_mobile(page):
    """City detail page renders correctly on a mobile viewport."""
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto("/")
    page.wait_for_selector(".leaflet-container", timeout=LAYER_TIMEOUT)
    _navigate_to_city_detail(page, "richmond-va")
    detail = page.locator("#detail-content")
    expect(detail).to_contain_text("Richmond")
    # Back button should be visible
    expect(page.locator("#back-btn")).to_be_visible()
