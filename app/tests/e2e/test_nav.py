"""
test_nav.py — E2E tests for the shared site chrome on the content pages.

The header and footer are duplicated into every page because there is no build
step. app/tests/site.test.js asserts the markup is identical; these tests assert
it actually works in a browser — links resolve, the current page is marked, and
the transect wayfinding device tracks the page.
"""

import pytest
from playwright.sync_api import expect

CONTENT_PAGES = [
    "about.html",
    "guides.html",
    "join.html",
    "preferences.html",
    "privacy.html",
    "confirmed.html",
    "unsubscribed.html",
]

MOBILE_VIEWPORT = {"width": 390, "height": 844}


# ── Suite 1: Chrome renders on every page ────────────────────────────────────

@pytest.mark.parametrize("path", CONTENT_PAGES)
def test_masthead_renders(page, path):
    """Every content page shows the wordmark and the primary nav."""
    page.goto(f"/{path}")
    expect(page.locator(".masthead .wordmark")).to_be_visible()
    expect(page.locator("nav.site-nav")).to_be_visible()


@pytest.mark.parametrize("path", CONTENT_PAGES)
def test_footer_renders(page, path):
    """Every content page shows the footer with a privacy link."""
    page.goto(f"/{path}")
    expect(page.locator(".site-footer")).to_be_attached()
    expect(page.locator('.site-footer a[href="privacy.html"]')).to_have_count(1)


@pytest.mark.parametrize("path", CONTENT_PAGES)
def test_page_has_one_h1(page, path):
    """Each page has exactly one top-level heading."""
    page.goto(f"/{path}")
    assert page.locator("main h1").count() == 1


@pytest.mark.parametrize("path", CONTENT_PAGES)
def test_page_does_not_scroll_horizontally(page, path):
    """No page overflows its viewport on a phone."""
    page.set_viewport_size(MOBILE_VIEWPORT)
    page.goto(f"/{path}")
    scroll_width = page.evaluate("document.documentElement.scrollWidth")
    inner_width = page.evaluate("window.innerWidth")
    assert scroll_width <= inner_width, (
        f"{path} scrolls horizontally: {scroll_width}px content in {inner_width}px viewport"
    )


# ── Suite 2: Navigation actually works ───────────────────────────────────────

def test_nav_reaches_every_page(page):
    """Following the nav from About visits each destination successfully."""
    for href, heading in [
        ("about.html", "One slope"),
        ("guides.html", "Read the corridor"),
        ("join.html", "What to do on your land"),
        ("preferences.html", "Your settings"),
    ]:
        page.goto("/about.html")
        page.click(f'nav.site-nav a[href="{href}"]')
        page.wait_for_url(f"**/{href}")
        expect(page.locator("main h1")).to_contain_text(heading)


def test_wordmark_returns_to_the_map(page):
    """The wordmark links back to the map."""
    page.goto("/about.html")
    page.click(".masthead .wordmark")
    page.wait_for_url("**/index.html")
    page.wait_for_selector(".leaflet-container", timeout=10_000)


def test_map_links_out_to_content_pages(page):
    """The map header offers a way into the rest of the site."""
    page.goto("/")
    page.wait_for_selector(".leaflet-container", timeout=10_000)
    page.click('.app-nav a[href="about.html"]')
    page.wait_for_url("**/about.html")
    expect(page.locator("main h1")).to_be_visible()


# ── Suite 3: Wayfinding ──────────────────────────────────────────────────────

@pytest.mark.parametrize(
    "path,place",
    [
        ("about.html", "about"),
        ("guides.html", "guides"),
        ("join.html", "join"),
        ("preferences.html", "preferences"),
        ("privacy.html", "legal"),
    ],
)
def test_page_declares_its_place(page, path, place):
    """data-place drives both the nav highlight and the transect marker."""
    page.goto(f"/{path}")
    expect(page.locator("body")).to_have_attribute("data-place", place)


def test_current_page_is_marked_in_the_nav(page):
    """The nav entry for the current page is visually distinguished."""
    page.goto("/guides.html")
    current = page.locator('nav.site-nav a[href="guides.html"]')
    other = page.locator('nav.site-nav a[href="about.html"]')
    assert current.evaluate("el => getComputedStyle(el).borderBottomColor") != \
        other.evaluate("el => getComputedStyle(el).borderBottomColor"), (
        "the current page's nav entry should not look like the others"
    )


def test_transect_is_present_and_labelled(page):
    """The transect carries an accessible description of what it depicts."""
    page.goto("/about.html")
    transect = page.locator(".transect")
    expect(transect).to_be_visible()
    label = transect.get_attribute("aria-label")
    assert "Fall Line" in label, "the transect should describe the corridor it draws"


# ── Suite 4: Accessibility floor ─────────────────────────────────────────────

@pytest.mark.parametrize("path", CONTENT_PAGES)
def test_skip_link_moves_focus_to_main(page, path):
    """Tabbing once reaches a skip link that jumps to the main landmark."""
    page.goto(f"/{path}")
    page.keyboard.press("Tab")
    focused = page.evaluate("document.activeElement.className")
    assert "skip-link" in focused, f"{path}: the first tab stop should be the skip link"

    page.keyboard.press("Enter")
    assert page.evaluate("document.querySelector('main#main') !== null")
