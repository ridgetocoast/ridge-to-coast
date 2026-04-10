"""
test_search.py — E2E tests for the location search bar.

Tests the bottom search bar UI, zip/city geocoding via mocked Nominatim,
GPS geolocation, and corridor boundary messaging.

Nominatim requests are intercepted via page.route() so tests run
offline without depending on the live API.
"""

import pytest
from playwright.sync_api import expect, Route

NOMINATIM_PATTERN = "**/nominatim.openstreetmap.org/**"
LAYER_TIMEOUT = 10_000
SEARCH_TIMEOUT = 5_000

# ── Nominatim mock helpers ────────────────────────────────────────────────────

def mock_nominatim(route: Route, lat: str, lon: str, display: str) -> None:
    """Fulfill a Nominatim request with a single-result JSON payload."""
    route.fulfill(
        status=200,
        content_type="application/json",
        body=f'[{{"lat":"{lat}","lon":"{lon}","display_name":"{display}"}}]',
    )


def mock_nominatim_empty(route: Route) -> None:
    """Fulfill a Nominatim request with an empty result (no match)."""
    route.fulfill(status=200, content_type="application/json", body="[]")


# ── Suite 1: Search bar presence ──────────────────────────────────────────────

def test_search_bar_visible(page):
    """Bottom search bar is present and visible on load."""
    page.goto("/")
    expect(page.locator("#search-bar")).to_be_visible()


def test_search_input_visible(page):
    """Text input inside the search bar is visible and focusable."""
    page.goto("/")
    expect(page.locator("#search-input")).to_be_visible()


def test_locate_button_visible(page):
    """GPS 'Use my location' button is visible."""
    page.goto("/")
    expect(page.locator("#locate-btn")).to_be_visible()


def test_search_bar_at_bottom(page):
    """Search bar is positioned at the bottom of the viewport."""
    page.goto("/")
    bar = page.locator("#search-bar")
    bar_box = bar.bounding_box()
    viewport = page.viewport_size
    # Bottom of bar should be at or near the bottom of the viewport
    assert bar_box["y"] + bar_box["height"] >= viewport["height"] - 20, (
        "Search bar should be pinned to the bottom of the viewport"
    )


def test_search_bar_visible_on_mobile(page):
    """Search bar is visible and accessible on iPhone 13 Pro viewport."""
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto("/")
    expect(page.locator("#search-bar")).to_be_visible()
    expect(page.locator("#search-input")).to_be_visible()


# ── Suite 2: Search interaction ───────────────────────────────────────────────

def test_empty_submit_shows_guidance(page):
    """Submitting an empty search shows a helpful status message."""
    page.goto("/")
    page.locator("#search-form").locator("[type=submit]").click()
    status = page.locator("#search-status")
    expect(status).to_be_visible(timeout=SEARCH_TIMEOUT)
    text = status.text_content().lower()
    assert "zip" in text or "city" in text or "enter" in text, (
        f"Expected guidance text, got: '{text}'"
    )


def test_zip_search_calls_nominatim(page):
    """Submitting a zip code fires a Nominatim request."""
    page.goto("/")
    page.wait_for_selector(".leaflet-container", timeout=LAYER_TIMEOUT)

    with page.expect_request(NOMINATIM_PATTERN, timeout=SEARCH_TIMEOUT) as req_info:
        page.route(NOMINATIM_PATTERN, lambda r: mock_nominatim(
            r, "37.5407", "-77.4360", "Richmond, Virginia, United States"
        ))
        page.locator("#search-input").fill("23219")
        page.locator("#search-form").locator("[type=submit]").click()

    assert req_info.value is not None, "Expected a Nominatim request to be made"


def test_zip_search_url_contains_postalcode(page):
    """Zip code search sends postalcode= parameter to Nominatim."""
    page.goto("/")
    page.wait_for_selector(".leaflet-container", timeout=LAYER_TIMEOUT)

    captured = {}

    def intercept(route: Route):
        captured["url"] = route.request.url
        mock_nominatim(route, "37.5407", "-77.4360", "Richmond, Virginia")

    page.route(NOMINATIM_PATTERN, intercept)
    page.locator("#search-input").fill("23219")
    page.locator("#search-form").locator("[type=submit]").click()
    page.wait_for_timeout(1000)

    assert "postalcode" in captured.get("url", ""), (
        f"Expected postalcode= in Nominatim URL, got: {captured.get('url')}"
    )


def test_city_search_url_contains_q(page):
    """City name search sends q= parameter to Nominatim."""
    page.goto("/")
    page.wait_for_selector(".leaflet-container", timeout=LAYER_TIMEOUT)

    captured = {}

    def intercept(route: Route):
        captured["url"] = route.request.url
        mock_nominatim(route, "35.7796", "-78.6382", "Raleigh, North Carolina")

    page.route(NOMINATIM_PATTERN, intercept)
    page.locator("#search-input").fill("Raleigh NC")
    page.locator("#search-form").locator("[type=submit]").click()
    page.wait_for_timeout(1000)

    assert "&q=" in captured.get("url", ""), (
        f"Expected q= in Nominatim URL, got: {captured.get('url')}"
    )


def test_no_results_shows_not_found(page):
    """When Nominatim returns no results, a 'not found' message is shown."""
    page.goto("/")
    page.wait_for_selector(".leaflet-container", timeout=LAYER_TIMEOUT)
    page.route(NOMINATIM_PATTERN, mock_nominatim_empty)

    page.locator("#search-input").fill("xyzxyznotaplace99999")
    page.locator("#search-form").locator("[type=submit]").click()

    status = page.locator("#search-status")
    # to_contain_text retries until the text matches (auto-waits for fetch to resolve)
    expect(status).to_contain_text("not found", timeout=SEARCH_TIMEOUT)


def test_outside_corridor_shows_note(page):
    """Result outside the fall line corridor triggers a corridor note."""
    page.goto("/")
    page.wait_for_selector(".leaflet-container", timeout=LAYER_TIMEOUT)
    # Boston MA — north of the corridor (BBOX_NORTH ~41.4°N, Boston ~42.4°N)
    page.route(NOMINATIM_PATTERN, lambda r: mock_nominatim(
        r, "42.3601", "-71.0589", "Boston, Massachusetts"
    ))

    page.locator("#search-input").fill("Boston MA")
    page.locator("#search-form").locator("[type=submit]").click()

    status = page.locator("#search-status")
    expect(status).to_contain_text("corridor", timeout=SEARCH_TIMEOUT)


def test_in_corridor_no_corridor_note(page):
    """Result inside the corridor does not show the corridor warning."""
    page.goto("/")
    page.wait_for_selector(".leaflet-container", timeout=LAYER_TIMEOUT)
    page.route(NOMINATIM_PATTERN, lambda r: mock_nominatim(
        r, "37.5407", "-77.4360", "Richmond, Virginia"
    ))

    page.locator("#search-input").fill("Richmond VA")
    page.locator("#search-form").locator("[type=submit]").click()
    page.wait_for_timeout(1500)

    status = page.locator("#search-status")
    # Either hidden or doesn't mention corridor
    if status.get_attribute("hidden") is None:
        assert "corridor" not in status.text_content().lower()
