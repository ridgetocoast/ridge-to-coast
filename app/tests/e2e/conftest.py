"""
conftest.py — pytest-playwright fixtures for Ridge to Coast E2E tests.

Run locally:
    pip install -r tests/e2e/requirements.txt
    playwright install chromium
    python -m http.server 8000 &
    pytest tests/e2e/ -v --base-url http://localhost:8000

In CI the base-url is injected via --base-url argument in the workflow.
"""

import pytest


@pytest.fixture
def page(page):
    """
    Wrap the default pytest-playwright page fixture to collect uncaught
    JavaScript errors. Tests will fail automatically if the page throws
    any unhandled JS exception during the test run.
    """
    js_errors = []
    page.on("pageerror", lambda exc: js_errors.append(str(exc)))
    page._js_errors = js_errors
    yield page
    assert js_errors == [], f"Uncaught JavaScript error(s) during test:\n" + "\n".join(js_errors)
