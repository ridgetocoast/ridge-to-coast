"""
test_legend_toggle.py — E2E tests for the collapsible legend panel.

On mobile (≤600px wide) the legend starts collapsed to maximise map
visibility. On desktop it starts expanded. A toggle button lets users
show/hide the legend body at any time.
"""

import pytest
from playwright.sync_api import expect

LAYER_TIMEOUT = 10_000

MOBILE_VIEWPORT  = {"width": 390, "height": 844}   # iPhone 13 Pro
DESKTOP_VIEWPORT = {"width": 1280, "height": 800}


# ── Suite 1: Toggle button presence ──────────────────────────────────────────

def test_legend_toggle_button_exists(page):
    """A toggle button exists inside the legend panel."""
    page.goto("/")
    expect(page.locator("#legend-toggle")).to_be_visible()


def test_legend_has_collapsible_body(page):
    """The legend has a #legend-body element that can be shown/hidden."""
    page.goto("/")
    assert page.locator("#legend-body").count() == 1, (
        "Expected exactly one #legend-body element"
    )


# ── Suite 2: Default state by viewport ───────────────────────────────────────

def test_legend_starts_collapsed_on_mobile(page):
    """On a mobile viewport the legend body is hidden by default."""
    page.set_viewport_size(MOBILE_VIEWPORT)
    page.goto("/")
    page.wait_for_selector(".leaflet-container", timeout=LAYER_TIMEOUT)
    assert page.locator("#legend-body").get_attribute("hidden") is not None, (
        "Legend body should start hidden on mobile to maximise map visibility"
    )


def test_legend_starts_expanded_on_desktop(page):
    """On a desktop viewport the legend body is visible by default."""
    page.set_viewport_size(DESKTOP_VIEWPORT)
    page.goto("/")
    page.wait_for_selector(".leaflet-container", timeout=LAYER_TIMEOUT)
    assert page.locator("#legend-body").get_attribute("hidden") is None, (
        "Legend body should start expanded on desktop"
    )


# ── Suite 3: Toggle interaction ───────────────────────────────────────────────

def test_toggle_expands_legend_on_mobile(page):
    """Clicking the toggle on mobile expands the legend body."""
    page.set_viewport_size(MOBILE_VIEWPORT)
    page.goto("/")
    page.wait_for_selector(".leaflet-container", timeout=LAYER_TIMEOUT)
    # Confirm it starts collapsed
    assert page.locator("#legend-body").get_attribute("hidden") is not None
    # Click to expand
    page.locator("#legend-toggle").click()
    assert page.locator("#legend-body").get_attribute("hidden") is None, (
        "Legend body should be visible after clicking the toggle"
    )


def test_toggle_collapses_legend_on_desktop(page):
    """Clicking the toggle on desktop collapses the legend body."""
    page.set_viewport_size(DESKTOP_VIEWPORT)
    page.goto("/")
    page.wait_for_selector(".leaflet-container", timeout=LAYER_TIMEOUT)
    # Confirm it starts expanded
    assert page.locator("#legend-body").get_attribute("hidden") is None
    # Click to collapse
    page.locator("#legend-toggle").click()
    assert page.locator("#legend-body").get_attribute("hidden") is not None, (
        "Legend body should be hidden after clicking toggle on desktop"
    )


def test_toggle_is_a_roundtrip(page):
    """The toggle alternates between collapsed and expanded on each click."""
    page.set_viewport_size(DESKTOP_VIEWPORT)
    page.goto("/")
    page.wait_for_selector(".leaflet-container", timeout=LAYER_TIMEOUT)

    toggle = page.locator("#legend-toggle")
    body   = page.locator("#legend-body")

    # Start: expanded
    assert body.get_attribute("hidden") is None
    toggle.click()
    # After 1st click: collapsed
    assert body.get_attribute("hidden") is not None
    toggle.click()
    # After 2nd click: expanded again
    assert body.get_attribute("hidden") is None


def test_legend_header_always_visible(page):
    """The legend header (title + toggle button) stays visible when collapsed."""
    page.set_viewport_size(MOBILE_VIEWPORT)
    page.goto("/")
    page.wait_for_selector(".leaflet-container", timeout=LAYER_TIMEOUT)
    # Even when body is collapsed, header should be visible
    expect(page.locator(".legend-header")).to_be_visible()
    expect(page.locator("#legend-toggle")).to_be_visible()


def test_layer_toggles_still_work_after_expand(page):
    """Layer toggles inside the legend function correctly after expanding on mobile."""
    page.set_viewport_size(MOBILE_VIEWPORT)
    page.goto("/")
    page.wait_for_selector(".leaflet-overlay-pane path", timeout=LAYER_TIMEOUT)

    # Expand the legend
    page.locator("#legend-toggle").click()
    page.wait_for_timeout(200)

    # The fall line toggle should now be accessible and work
    before = page.locator(".leaflet-overlay-pane path").count()
    page.locator("#toggle-fallline").uncheck()
    page.wait_for_timeout(300)
    after = page.locator(".leaflet-overlay-pane path").count()
    assert after < before, "Fall line toggle should still reduce path count after legend expand"
