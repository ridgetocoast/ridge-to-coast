"""
test_map.py — Playwright E2E tests for Ridge to Coast.

Tests run against a local http.server (or the live GitHub Pages URL).
Each test gets a fresh page; uncaught JS errors cause automatic failure
via the conftest.py page fixture.
"""

import pytest
from playwright.sync_api import expect


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

LAYER_TIMEOUT  = 10_000   # ms — Leaflet SVG paths (local data, no network needed)
FETCH_TIMEOUT  = 20_000   # ms — hardiness.geojson fetch


def wait_for_map(page):
    """Navigate to root and wait for Leaflet vector layers to render.

    We wait for SVG overlay paths, not tile images — tiles load from an
    external CDN (CARTO) that may be unavailable in restricted environments.
    Vector layers (fall line, regions) load entirely from local data and
    initialise independently of tile loading.
    """
    page.goto("/")
    # Leaflet adds .leaflet-container once the map object is created
    page.wait_for_selector(".leaflet-container", timeout=LAYER_TIMEOUT)
    # Fall line + region polygons render as SVG paths in the overlay pane
    page.wait_for_selector(".leaflet-overlay-pane path", timeout=LAYER_TIMEOUT)


# ---------------------------------------------------------------------------
# Suite 1 — Page load
# ---------------------------------------------------------------------------

def test_page_title(page):
    """App title is 'Ridge to Coast'."""
    page.goto("/")
    expect(page).to_have_title("Ridge to Coast")


def test_map_container_visible(page):
    """#map element is present and visible."""
    page.goto("/")
    expect(page.locator("#map")).to_be_visible()


def test_legend_visible(page):
    """Legend panel is rendered."""
    page.goto("/")
    expect(page.locator("#legend")).to_be_visible()


def test_all_toggles_present(page):
    """All layer toggle checkboxes exist."""
    page.goto("/")
    assert page.locator("#toggle-regions").count() == 1
    assert page.locator("#toggle-fallline").count() == 1
    assert page.locator("#toggle-cities").count() == 1
    assert page.locator("#toggle-rivers").count() == 1
    assert page.locator("#toggle-hardiness").count() == 1


def test_no_js_errors_on_load(page):
    """Page loads without uncaught JavaScript errors.
    (Assertion is in conftest.py page fixture — this test just navigates.)"""
    page.goto("/")
    page.wait_for_selector(".leaflet-container", timeout=LAYER_TIMEOUT)


# ---------------------------------------------------------------------------
# Suite 2 — Layer rendering
# ---------------------------------------------------------------------------

def test_vector_layers_render(page):
    """Fall line, region shading, and rivers SVG paths are present after load."""
    wait_for_map(page)
    paths = page.locator(".leaflet-overlay-pane path")
    # 3 region polygons + 2 fall line segments + 14 rivers = 19+ paths
    assert paths.count() >= 5, (
        f"Expected at least 5 SVG paths (regions + fall line + rivers), got {paths.count()}"
    )


def test_regions_toggle_off_removes_layers(page):
    """Unchecking 'Region shading' removes region paths."""
    wait_for_map(page)
    before = page.locator(".leaflet-overlay-pane path").count()
    page.locator("#toggle-regions").uncheck()
    page.wait_for_timeout(300)  # allow Leaflet to remove elements
    after = page.locator(".leaflet-overlay-pane path").count()
    assert after < before, "Unchecking regions should reduce the SVG path count"


def test_regions_toggle_roundtrip(page):
    """Region shading can be toggled off and back on."""
    wait_for_map(page)
    toggle = page.locator("#toggle-regions")
    toggle.uncheck()
    page.wait_for_timeout(300)
    toggle.check()
    page.wait_for_timeout(300)
    paths = page.locator(".leaflet-overlay-pane path")
    assert paths.count() >= 3


def test_fallline_toggle_off(page):
    """Unchecking 'Fall line' removes the fall line path."""
    wait_for_map(page)
    before = page.locator(".leaflet-overlay-pane path").count()
    page.locator("#toggle-fallline").uncheck()
    page.wait_for_timeout(300)
    after = page.locator(".leaflet-overlay-pane path").count()
    assert after < before, "Unchecking fall line should reduce the SVG path count"


# ---------------------------------------------------------------------------
# Suite 3 — Hardiness zone layer
# ---------------------------------------------------------------------------

def test_hardiness_toggle_unchecked_by_default(page):
    """Hardiness zone toggle is OFF when the page loads."""
    page.goto("/")
    assert not page.locator("#toggle-hardiness").is_checked()


def test_hardiness_legend_hidden_by_default(page):
    """Hardiness zone legend section is hidden until toggled on."""
    page.goto("/")
    assert page.locator("#hardiness-legend").get_attribute("hidden") is not None


def test_hardiness_fetch_returns_200(page):
    """Clicking the hardiness toggle fetches data/hardiness.geojson with HTTP 200."""
    wait_for_map(page)
    with page.expect_response("**/data/hardiness.geojson", timeout=FETCH_TIMEOUT) as resp_info:
        page.locator("#toggle-hardiness").check()
    response = resp_info.value
    assert response.status == 200, (
        f"Expected HTTP 200 for hardiness.geojson, got {response.status}"
    )


def test_hardiness_legend_populates(page):
    """After toggling on, zone swatches appear in the legend."""
    wait_for_map(page)
    with page.expect_response("**/data/hardiness.geojson", timeout=FETCH_TIMEOUT):
        page.locator("#toggle-hardiness").check()
    # Wait for legend items to be created by JS
    page.wait_for_selector(".zone-swatches .legend-item", timeout=FETCH_TIMEOUT)
    swatches = page.locator(".zone-swatches .legend-item")
    assert swatches.count() > 0, "Expected at least one hardiness zone swatch in legend"


def test_hardiness_layer_adds_paths(page):
    """After loading, hardiness zone polygons appear as SVG paths."""
    wait_for_map(page)
    before = page.locator(".leaflet-overlay-pane path").count()
    with page.expect_response("**/data/hardiness.geojson", timeout=FETCH_TIMEOUT):
        page.locator("#toggle-hardiness").check()
    page.wait_for_selector(".zone-swatches .legend-item", timeout=FETCH_TIMEOUT)
    page.wait_for_timeout(500)  # allow Leaflet to render polygons
    after = page.locator(".leaflet-overlay-pane path").count()
    assert after > before, "Hardiness toggle should add SVG paths to the overlay pane"


def test_hardiness_toggle_off_hides_legend(page):
    """Unchecking hardiness toggle hides the legend section."""
    wait_for_map(page)
    with page.expect_response("**/data/hardiness.geojson", timeout=FETCH_TIMEOUT):
        page.locator("#toggle-hardiness").check()
    page.wait_for_selector(".zone-swatches .legend-item", timeout=FETCH_TIMEOUT)
    # Now turn it off
    page.locator("#toggle-hardiness").uncheck()
    page.wait_for_timeout(300)
    assert page.locator("#hardiness-legend").get_attribute("hidden") is not None, (
        "Hardiness legend should be hidden after unchecking the toggle"
    )


def test_hardiness_second_toggle_uses_cache(page):
    """Toggling hardiness off then on again does NOT fire a second network request."""
    wait_for_map(page)
    fetch_count = {"n": 0}
    page.on("response", lambda r: fetch_count.update({"n": fetch_count["n"] + 1})
            if "hardiness.geojson" in r.url else None)

    with page.expect_response("**/data/hardiness.geojson", timeout=FETCH_TIMEOUT):
        page.locator("#toggle-hardiness").check()
    page.wait_for_selector(".zone-swatches .legend-item", timeout=FETCH_TIMEOUT)

    page.locator("#toggle-hardiness").uncheck()
    page.wait_for_timeout(300)
    before = fetch_count["n"]

    page.locator("#toggle-hardiness").check()
    page.wait_for_timeout(500)
    assert fetch_count["n"] == before, (
        "Second toggle-on should use the in-memory cache, not fire a new fetch"
    )


# ---------------------------------------------------------------------------
# Suite 4 — Mobile viewport
# ---------------------------------------------------------------------------

def test_mobile_map_visible(page):
    """Map fills the screen on a 375×667 (iPhone SE) viewport."""
    page.set_viewport_size({"width": 375, "height": 667})
    page.goto("/")
    page.wait_for_selector(".leaflet-container", timeout=LAYER_TIMEOUT)
    map_el = page.locator("#map")
    expect(map_el).to_be_visible()
    box = map_el.bounding_box()
    assert box["width"] > 300, "Map should fill most of the mobile screen width"
    assert box["height"] > 400, "Map should fill most of the mobile screen height"


def test_mobile_legend_visible(page):
    """Legend panel is visible on mobile viewport."""
    page.set_viewport_size({"width": 375, "height": 667})
    page.goto("/")
    expect(page.locator("#legend")).to_be_visible()


def test_mobile_subtitle_hidden(page):
    """Subtitle ('DC · Richmond · Raleigh') is hidden on small screens per CSS."""
    page.set_viewport_size({"width": 375, "height": 667})
    page.goto("/")
    subtitle = page.locator(".app-header .subtitle")
    # CSS sets display:none at <480px — element exists but is not visible
    assert not subtitle.is_visible(), "Subtitle should be hidden on narrow mobile viewport"


# ---------------------------------------------------------------------------
# Suite 5 — Blue Ridge region
# ---------------------------------------------------------------------------

def test_blue_ridge_swatch_in_legend(page):
    """Blue Ridge / Appalachians swatch appears in the legend."""
    page.goto("/")
    swatch = page.locator(".swatch.blueridge")
    expect(swatch).to_be_attached(timeout=LAYER_TIMEOUT)


# ---------------------------------------------------------------------------
# Suite 6 — Detail page hash routing
# ---------------------------------------------------------------------------

DETAIL_TIMEOUT = 5_000


def test_detail_view_hidden_on_load(page):
    """Detail view is hidden when the page loads normally."""
    page.goto("/")
    detail = page.locator("#detail-view")
    assert detail.get_attribute("hidden") is not None, \
        "detail-view should be hidden on initial load"


def test_region_detail_page_loads(page):
    """Navigating to /#detail/region/piedmont shows the detail view."""
    page.goto("/#detail/region/piedmont")
    page.wait_for_selector("#detail-view:not([hidden])", timeout=DETAIL_TIMEOUT)
    content = page.locator("#detail-content")
    expect(content).to_contain_text("Piedmont")


def test_region_detail_page_back_button(page):
    """Back button on detail page returns to map view."""
    # Load map first, then navigate to detail — creates back-history entry
    page.goto("/")
    page.wait_for_selector(".leaflet-container", timeout=LAYER_TIMEOUT)
    page.evaluate("location.hash = '#detail/region/piedmont'")
    page.wait_for_selector("#detail-view:not([hidden])", timeout=DETAIL_TIMEOUT)
    page.locator("#back-btn").click()
    page.wait_for_selector("#map-view:not([hidden])", timeout=DETAIL_TIMEOUT)
    expect(page.locator("#map")).to_be_visible()


def test_blue_ridge_detail_page(page):
    """Blue Ridge detail page shows correct region content."""
    page.goto("/#detail/region/blueRidge")
    page.wait_for_selector("#detail-view:not([hidden])", timeout=DETAIL_TIMEOUT)
    content = page.locator("#detail-content")
    expect(content).to_contain_text("Blue Ridge")
    expect(content).to_contain_text("Fraser Fir")


def test_zone_detail_page_loads(page):
    """Navigating to /#detail/zone/7b shows zone detail content."""
    page.goto("/#detail/zone/7b")
    page.wait_for_selector("#detail-view:not([hidden])", timeout=DETAIL_TIMEOUT)
    content = page.locator("#detail-content")
    expect(content).to_contain_text("Zone 7b")
    expect(content).to_contain_text("frost")


# ---------------------------------------------------------------------------
# Suite 7 — Rivers layer
# ---------------------------------------------------------------------------

def test_rivers_toggle_checked_by_default(page):
    """Rivers toggle is checked (visible) by default."""
    page.goto("/")
    toggle = page.locator("#toggle-rivers")
    expect(toggle).to_be_checked(timeout=LAYER_TIMEOUT)


def test_river_swatch_in_legend(page):
    """Rivers legend swatch is present in the DOM."""
    page.goto("/")
    swatch = page.locator(".swatch.river")
    expect(swatch).to_be_attached(timeout=LAYER_TIMEOUT)


def test_rivers_toggle_removes_paths(page):
    """Unchecking the rivers toggle reduces the SVG path count."""
    wait_for_map(page)
    before = page.locator(".leaflet-overlay-pane path").count()
    page.locator("#toggle-rivers").uncheck()
    page.wait_for_timeout(300)
    after = page.locator(".leaflet-overlay-pane path").count()
    assert after < before, "Unchecking rivers should reduce the SVG path count"


def test_rivers_toggle_roundtrip(page):
    """Rivers layer can be toggled off and back on."""
    wait_for_map(page)
    toggle = page.locator("#toggle-rivers")
    toggle.uncheck()
    page.wait_for_timeout(300)
    toggle.check()
    page.wait_for_timeout(300)
    expect(toggle).to_be_checked()


def test_river_detail_page_loads(page):
    """Navigating to /#detail/river/james shows the James River detail page."""
    page.goto("/#detail/river/james")
    page.wait_for_selector("#detail-view:not([hidden])", timeout=DETAIL_TIMEOUT)
    content = page.locator("#detail-content")
    expect(content).to_contain_text("James")


def test_blue_ridge_click_navigates_to_detail(page):
    """Clicking a Blue Ridge-region city detail hash shows Blue Ridge content."""
    page.goto("/")
    page.wait_for_selector(".leaflet-container", timeout=LAYER_TIMEOUT)
    page.evaluate("location.hash = '#detail/region/blueRidge'")
    page.wait_for_selector("#detail-view:not([hidden])", timeout=DETAIL_TIMEOUT)
    content = page.locator("#detail-content")
    expect(content).to_contain_text("Blue Ridge")


# ---------------------------------------------------------------------------
# Suite 8 — Valley and Ridge region
# ---------------------------------------------------------------------------

def test_valley_ridge_swatch_in_legend(page):
    """Valley and Ridge legend swatch is present in the DOM."""
    page.goto("/")
    swatch = page.locator(".swatch.valleyridge")
    expect(swatch).to_be_attached(timeout=LAYER_TIMEOUT)


def test_valley_ridge_detail_page_loads(page):
    """Navigating to /#detail/region/valleyRidge shows Valley and Ridge content."""
    page.goto("/#detail/region/valleyRidge")
    page.wait_for_selector("#detail-view:not([hidden])", timeout=DETAIL_TIMEOUT)
    content = page.locator("#detail-content")
    expect(content).to_contain_text("Valley")


def test_valley_ridge_detail_contains_plants(page):
    """Valley and Ridge detail page includes native plant section."""
    page.goto("/#detail/region/valleyRidge")
    page.wait_for_selector("#detail-view:not([hidden])", timeout=DETAIL_TIMEOUT)
    content = page.locator("#detail-content")
    # Pawpaw is a classic Valley and Ridge species
    expect(content).to_contain_text("Pawpaw")
