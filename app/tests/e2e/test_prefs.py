"""
test_prefs.py — E2E tests for device-local preferences.

Settings live in localStorage under r2c.prefs.v1 and never leave the browser.
The behaviour that matters is that a choice made on the map survives a reload,
that the preferences page shows the same state, and that erasing works.
"""

import json

import pytest
from playwright.sync_api import expect

MAP_TIMEOUT = 10_000

# The hardiness layer is the only one that starts off and needs no API, so it is
# what proves an off-to-on choice persists. It is also a 3.9 MB GeoJSON that the
# dev server sends `no-store`, so it re-downloads on every reload — hence the
# much longer wait wherever a reload happens with it enabled.
HARDINESS_TIMEOUT = 45_000

STORAGE_KEY = "r2c.prefs.v1"
LAYER_ID = "toggle-hardiness"
PREF_ID = "pref-hardiness"


def stored_prefs(page):
    raw = page.evaluate(f"localStorage.getItem('{STORAGE_KEY}')")
    return json.loads(raw) if raw else None


def clear_prefs(page):
    page.evaluate(f"localStorage.removeItem('{STORAGE_KEY}')")


# ── Suite 1: Nothing is stored until something is changed ────────────────────

def test_no_storage_written_on_a_plain_visit(page):
    """Loading the map does not write anything to storage on its own."""
    page.goto("/")
    page.wait_for_selector(".leaflet-container", timeout=MAP_TIMEOUT)
    clear_prefs(page)
    page.reload()
    page.wait_for_selector(".leaflet-container", timeout=MAP_TIMEOUT)
    assert stored_prefs(page) is None, "a passive visit should store nothing"


# ── Suite 2: Choices persist ─────────────────────────────────────────────────

def test_layer_choice_survives_a_reload(page):
    """Turning a layer on keeps it on after a reload."""
    page.goto("/")
    page.wait_for_selector(".leaflet-container", timeout=MAP_TIMEOUT)
    clear_prefs(page)

    page.check(f"#{LAYER_ID}")
    expect(page.locator(f"#{LAYER_ID}")).to_be_checked()
    assert stored_prefs(page)["layers"]["hardiness"] is True

    page.reload()
    page.wait_for_selector(".leaflet-container", timeout=HARDINESS_TIMEOUT)
    expect(page.locator(f"#{LAYER_ID}")).to_be_checked()


def test_turning_a_default_on_layer_off_persists(page):
    """A layer that starts on stays off once turned off."""
    page.goto("/")
    page.wait_for_selector(".leaflet-container", timeout=MAP_TIMEOUT)
    clear_prefs(page)

    page.uncheck("#toggle-cities")
    assert stored_prefs(page)["layers"]["cities"] is False

    page.reload()
    page.wait_for_selector(".leaflet-container", timeout=MAP_TIMEOUT)
    expect(page.locator("#toggle-cities")).not_to_be_checked()


def test_legend_collapse_persists(page):
    """Collapsing the legend is remembered."""
    page.set_viewport_size({"width": 1280, "height": 800})
    page.goto("/")
    page.wait_for_selector(".leaflet-container", timeout=MAP_TIMEOUT)
    clear_prefs(page)

    page.click("#legend-toggle")
    assert stored_prefs(page)["legendCollapsed"] is True

    page.reload()
    page.wait_for_selector(".leaflet-container", timeout=MAP_TIMEOUT)
    assert page.locator("#legend-body").is_hidden()


# ── Suite 3: The preferences page agrees with the map ────────────────────────

def test_preferences_page_reflects_map_choices(page):
    """A choice made on the map shows up on the preferences page."""
    page.goto("/")
    page.wait_for_selector(".leaflet-container", timeout=MAP_TIMEOUT)
    clear_prefs(page)
    page.check(f"#{LAYER_ID}")

    page.goto("/preferences.html")
    expect(page.locator(f"#{PREF_ID}")).to_be_checked()


def test_preferences_page_changes_reach_the_map(page):
    """A choice made on the preferences page applies to the map."""
    page.goto("/preferences.html")
    clear_prefs(page)
    page.reload()

    page.check(f"#{PREF_ID}")
    expect(page.locator("#saved-notice")).to_be_visible()

    page.goto("/")
    page.wait_for_selector(".leaflet-container", timeout=HARDINESS_TIMEOUT)
    expect(page.locator(f"#{LAYER_ID}")).to_be_checked()


def test_json_box_shows_the_current_settings(page):
    """The export box holds a readable copy of the stored settings."""
    page.goto("/preferences.html")
    clear_prefs(page)
    page.reload()
    page.check(f"#{PREF_ID}")

    exported = json.loads(page.input_value("#prefs-json"))
    assert exported["layers"]["hardiness"] is True
    assert exported["version"] == 1


def test_pasting_settings_applies_them(page):
    """Pasting an exported object and applying it takes effect."""
    page.goto("/preferences.html")
    clear_prefs(page)
    page.reload()

    page.fill("#prefs-json", json.dumps({
        "version": 1,
        "layers": {"regions": True, "fallline": True, "cities": False,
                   "hardiness": True, "gardens": False},
        "home": None, "zone": "8a", "units": "C", "legendCollapsed": False,
    }))
    page.click("#apply-json")

    expect(page.locator("#json-ok")).to_be_visible()
    expect(page.locator(f"#{PREF_ID}")).to_be_checked()
    expect(page.locator("#pref-zone")).to_have_value("8a")
    expect(page.locator("#pref-units")).to_have_value("C")


def test_pasting_junk_is_refused_without_losing_settings(page):
    """A bad paste reports an error and leaves the stored settings alone."""
    page.goto("/preferences.html")
    clear_prefs(page)
    page.reload()
    page.check(f"#{PREF_ID}")

    page.fill("#prefs-json", "{ not json at all")
    page.click("#apply-json")

    expect(page.locator("#json-error")).to_be_visible()
    expect(page.locator(f"#{PREF_ID}")).to_be_checked()
    assert stored_prefs(page)["layers"]["hardiness"] is True


# ── Suite 4: Erasing ─────────────────────────────────────────────────────────

def test_erase_returns_the_map_to_defaults(page):
    """Erasing settings restores the map's default layer state."""
    page.goto("/")
    page.wait_for_selector(".leaflet-container", timeout=MAP_TIMEOUT)
    clear_prefs(page)
    page.check(f"#{LAYER_ID}")
    page.uncheck("#toggle-cities")

    page.goto("/preferences.html")
    page.on("dialog", lambda dialog: dialog.accept())
    page.click("#reset-all")
    expect(page.locator("#json-ok")).to_be_visible()

    page.goto("/")
    page.wait_for_selector(".leaflet-container", timeout=HARDINESS_TIMEOUT)
    expect(page.locator(f"#{LAYER_ID}")).not_to_be_checked()
    expect(page.locator("#toggle-cities")).to_be_checked()
