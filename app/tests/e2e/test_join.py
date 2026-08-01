"""
test_join.py — E2E tests for the newsletter signup form.

The API is stubbed with page.route so these run without a Worker. The Worker's
own behaviour (double opt-in, honeypot, rate limiting, enumeration resistance)
is covered by workers/tests/subscribe.test.js.
"""

import json

import pytest
from playwright.sync_api import expect

SUBSCRIBE_GLOB = "**/v1/subscribe"


def stub_subscribe(page, status=202, body=None):
    """Intercept the signup request and record what was sent."""
    captured = {}

    def handler(route, request):
        captured["payload"] = json.loads(request.post_data or "{}")
        captured["method"] = request.method
        route.fulfill(
            status=status,
            content_type="application/json",
            body=json.dumps(body if body is not None else {
                "status": "pending",
                "message": "Check your inbox for a confirmation link.",
            }),
        )

    page.route(SUBSCRIBE_GLOB, handler)
    return captured


def fill_valid(page, email="grower@example.com", zone="7b"):
    page.fill("#email", email)
    if zone:
        page.select_option("#zone", zone)
    page.check("#consent")


# ── Suite 1: Client-side validation happens before any request ───────────────

def test_empty_email_is_rejected_without_a_request(page):
    captured = stub_subscribe(page)
    page.goto("/join.html")
    page.click("#submit-btn")

    expect(page.locator("#form-error")).to_be_visible()
    expect(page.locator("#form-error")).to_contain_text("Enter your email")
    assert "payload" not in captured, "no request should be sent for an empty form"


def test_malformed_email_is_rejected_without_a_request(page):
    captured = stub_subscribe(page)
    page.goto("/join.html")
    page.fill("#email", "not-an-email")
    page.check("#consent")
    page.click("#submit-btn")

    expect(page.locator("#form-error")).to_contain_text("does not look like an email")
    assert "payload" not in captured


def test_consent_is_required(page):
    captured = stub_subscribe(page)
    page.goto("/join.html")
    page.fill("#email", "grower@example.com")
    page.click("#submit-btn")

    expect(page.locator("#form-error")).to_contain_text("Tick the box")
    assert "payload" not in captured, "consent must be explicit before anything is sent"


# ── Suite 2: A valid signup ──────────────────────────────────────────────────

def test_valid_signup_shows_the_check_your_inbox_state(page):
    stub_subscribe(page)
    page.goto("/join.html")
    fill_valid(page)
    page.click("#submit-btn")

    expect(page.locator("#form-ok")).to_be_visible()
    expect(page.locator("#form-ok")).to_contain_text("Check your inbox")
    expect(page.locator("#form-ok")).to_contain_text("grower@example.com")
    expect(page.locator("#join-form")).to_be_hidden()


def test_signup_posts_the_expected_payload(page):
    captured = stub_subscribe(page)
    page.goto("/join.html")
    fill_valid(page)
    page.click("#submit-btn")
    expect(page.locator("#form-ok")).to_be_visible()

    assert captured["method"] == "POST"
    payload = captured["payload"]
    assert payload["email"] == "grower@example.com"
    assert payload["consent"] is True
    assert payload["zone"] == "7b"
    assert payload["source"] == "join.html"
    assert payload["website"] == "", "the honeypot must be empty for a real person"


def test_zone_is_remembered_locally_after_signup(page):
    stub_subscribe(page)
    page.goto("/join.html")
    page.evaluate("localStorage.removeItem('r2c.prefs.v1')")
    fill_valid(page, zone="8a")
    page.click("#submit-btn")
    expect(page.locator("#form-ok")).to_be_visible()

    stored = json.loads(page.evaluate("localStorage.getItem('r2c.prefs.v1')"))
    assert stored["zone"] == "8a"


def test_zone_is_prefilled_from_saved_settings(page):
    page.goto("/join.html")
    page.evaluate(
        "localStorage.setItem('r2c.prefs.v1', JSON.stringify({version:1, zone:'9a'}))"
    )
    page.reload()
    expect(page.locator("#zone")).to_have_value("9a")


def test_email_is_never_prefilled(page):
    """A saved zone is convenience; a saved email address would not be ours to assume."""
    page.goto("/join.html")
    page.evaluate(
        "localStorage.setItem('r2c.prefs.v1', JSON.stringify({version:1, zone:'7b'}))"
    )
    page.reload()
    expect(page.locator("#email")).to_have_value("")


# ── Suite 3: Failure states ──────────────────────────────────────────────────

def test_rate_limit_message_is_shown(page):
    stub_subscribe(page, status=429, body={"error": "Too many signups from this connection. Try again later."})
    page.goto("/join.html")
    fill_valid(page)
    page.click("#submit-btn")

    expect(page.locator("#form-error")).to_be_visible()
    expect(page.locator("#form-error")).to_contain_text("Too many signups")
    expect(page.locator("#join-form")).to_be_visible()


def test_server_error_keeps_the_form_available_for_retry(page):
    stub_subscribe(page, status=500, body={"error": "Could not record that signup."})
    page.goto("/join.html")
    fill_valid(page)
    page.click("#submit-btn")

    expect(page.locator("#form-error")).to_be_visible()
    expect(page.locator("#join-form")).to_be_visible()
    expect(page.locator("#submit-btn")).to_be_enabled()


def test_network_failure_reports_plainly(page):
    page.route(SUBSCRIBE_GLOB, lambda route, request: route.abort())
    page.goto("/join.html")
    fill_valid(page)
    page.click("#submit-btn")

    expect(page.locator("#form-error")).to_be_visible()
    expect(page.locator("#form-error")).to_contain_text("Could not reach the server")
    expect(page.locator("#submit-btn")).to_be_enabled()


# ── Suite 4: The honeypot ────────────────────────────────────────────────────

def test_honeypot_is_offscreen_and_out_of_the_tab_order(page):
    """
    The trap is positioned off-screen rather than display:none — some bots skip
    display:none fields — so the property to assert is that a person can neither
    see it nor tab into it, not that the browser calls it "hidden".
    """
    page.goto("/join.html")
    trap = page.locator("#website")
    assert trap.count() == 1

    box = trap.bounding_box()
    assert box is not None and box["x"] < 0, "the honeypot must sit outside the viewport"

    expect(trap).to_have_attribute("tabindex", "-1")
    expect(page.locator(".trap")).to_have_attribute("aria-hidden", "true")


def test_honeypot_is_not_reachable_by_tabbing(page):
    """Tabbing through the form never lands on the trap."""
    page.goto("/join.html")
    page.focus("#email")
    visited = []
    for _ in range(6):
        page.keyboard.press("Tab")
        visited.append(page.evaluate("document.activeElement.id"))
    assert "website" not in visited, f"the honeypot was reachable by tabbing: {visited}"


# ── Suite 5: Compliance surface ──────────────────────────────────────────────

def test_join_page_links_to_the_privacy_note(page):
    page.goto("/join.html")
    expect(page.locator('main a[href="privacy.html"]').first).to_be_visible()


def test_consent_checkbox_states_what_is_being_agreed_to(page):
    """The checkbox label is the consent record, so it has to say what it means."""
    page.goto("/join.html")
    label = page.locator('label[for="consent"]')
    expect(label).to_contain_text("send me")
    expect(label).to_contain_text("unsubscribe")


def test_consent_starts_unticked(page):
    """Pre-ticked consent is not consent."""
    page.goto("/join.html")
    expect(page.locator("#consent")).not_to_be_checked()
