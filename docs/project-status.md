# Project Status and Next Steps

**Snapshot date:** 2026-07-15

**Current checkout:** `claude/workers-api-impl` at `d1bddc4`

**Purpose:** evidence-based handoff for product delivery and Cloudflare release hardening

## Executive status

Ridge to Coast is a functioning, feature-rich map rather than an early prototype.
The static product baseline and living-data features are implemented, and the
Workers API implementation is integrated in the locally fetched `upstream/main`
history. The immediate work is release hardening: reconcile this old checkout
with `upstream/main`, make preview/stage/promote/rollback safe and observable,
then prove the path in non-production before shipping more product scope.

The current checkout is not a safe implementation base. Local refs show it is
2 commits ahead of and 21 commits behind `upstream/main`. In particular,
`upstream/main` already contains the Workers merge, the Terraform foundation,
and two Terraform fixes that are absent here. Preserve the dirty work, then move
it onto a fresh branch from the current upstream baseline before changing it.

## Delivered and verified

### Product baseline (Phase 1)

- The interactive Leaflet map, ecological regions, 51 city markers, hardiness
  zones, native plants, soils, rivers, detail routes, search, and corridor data
  are present in the repository.
- The location report and live NWS, USGS, and iNaturalist integrations described
  as Phase 2 in the root README are implemented in the frontend.
- `node --test app/tests/geo.test.js` passes 335 tests across 43 suites on this
  checkout.
- Cloudflare Pages, custom-domain, and production-availability claims are
  documented, but were not checked against live services during this audit.

### Workers/API delivery

- This branch contains real `/v1/ecoregion`, `/v1/calendar`, `/v1/plants`, and
  `/v1/gardens` handlers plus OpenAPI 1.1.0 changes and frontend gardens wiring.
- `node --test workers/tests/*.test.js` passes all 27 tests. The two logged
  gardens errors are expected negative-path test output; the suite still has
  zero failures.
- The locally fetched upstream history contains merge commit `e08b6a2` for the
  Workers implementation. This establishes repository integration, not current
  production deployment.

### Infrastructure already integrated upstream

- Local `upstream/main` contains the Terraform foundation from PR #17 and the
  token-rotation and audit-token scope fixes from PRs #18 and #19.
- Those files are not in the current checkout, so the untracked Terraform plan
  here is reference material, not the current implementation state.
- Whether the Terraform first apply, resource imports, secret cutover, and
  drift plan have succeeded in the live accounts was not verified here.

## Current uncommitted WIP

The working tree contains deployment-pipeline hardening that is not delivered:

- modified production deploy and promote/rollback workflows;
- a new PR-to-preprod Worker preview workflow;
- environment-scoped secret documentation and `CLAUDE.md` updates;
- an untracked Cloudflare configuration audit script;
- an untracked Terraform implementation plan; and
- an unrelated untracked reference note.

The changes aim to separate preview credentials, attach jobs to GitHub
Environments, include the shared Worker core in deploy triggers, and provide a
read-only configuration audit. They have not been exercised in GitHub Actions
or against Cloudflare in this audit.

## Current stage and immediate milestone

**Stage:** deployed-product maintenance with an API/release-platform hardening
track in progress.

**Immediate milestone:** a reconciled, least-privilege Workers release pipeline
that can deploy trusted code to preprod, stage one known production version,
promote that exact version, smoke-test it, and roll it back without exposing
production credentials or creating a frontend/API compatibility gap.

Do not start new Phase 2+ product features until this milestone is complete.

## Status update — 2026-09-20 (release-hardening pass)

This document was written 2026-07-15 against an older checkout. Where it
conflicts with the block below, this block is current.

**Closed since:**

- Step 1 — work rebased onto `upstream/main`; branch `claude/release-hardening`.
- Step 2 — secret cutover landed (`1a67f1b`). No workflow references
  `CLOUDFLARE_PREVIEW_API_TOKEN` or `CLOUDFLARE_ACCOUNT_ID` any more.
- Step 3 — `deploy-workers-preview.yml` gated to OWNER/MEMBER/COLLABORATOR, and
  the smoke script runs from a separate trusted base-repo checkout rather than
  `pr-source/`.
- Step 4 — promote now resolves and passes an explicit `<version-id>@100%`.
  Supersedes PR #21, whose implementation reintroduced the retired
  `CLOUDFLARE_ACCOUNT_ID` secret.
- Step 5 — `scripts/smoke-api.sh` asserts 200 + `application/json` on `/` and
  all four `/v1` routes; wired into preview, alpha, promote and rollback.
  `/v1/gardens` tolerates a 502 (Overpass is externally flaky) but not HTML.
- Step 7 — `pipeline.test.js` path fixed and wired into CI. The three
  assertions that then failed were not stale; they described guards the EPA
  workflow never had, so the guards were implemented (2 MB size cap, nine-region
  schema check, unit tests before the auto-commit). 38/38 pass.
- Step 8 — `CLAUDE.md`, `app/CLAUDE.md`, `app/docs/environments.md` and
  `infra/terraform/README.md` reconciled.

**Also fixed, not previously tracked:**

- `app/sw.js` precached `geo-data.js` but not `geo-data-core.js`, which
  `index.html` loads first and which `geo-data.js` throws without — offline
  load was broken. Fixed, with `app/tests/sw.test.js` guarding both this and
  dead precache entries.
- Deploys did not depend on tests. `test.yml` is now `workflow_call` and the
  deploy workflows `needs:` it.
- The e2e suite could not run locally (no venv, no pytest/playwright). Setup
  documented; 96/96 pass.
- The `audit` environment and `audit-readonly` token had no consumer.
  `audit-config.yml` now runs the audit script weekly.

**Open, and blocking:**

1. **`api.ridgetocoast.com` answers 403 with a Cloudflare bot challenge.** The
   Pages origin serves 200, so the app is healthy and the zone config is not.
   `fetch()` cannot solve a challenge, so the gardens layer — the only frontend
   feature wired to the API — is very likely broken in production.
   `infra/terraform/waf.tf` is written but **cannot be applied** (see 2). Note
   that plain Bot Fight Mode has no per-hostname exemption; if that is the
   source it must be turned off in the dashboard.
2. **The four `infra` environment secrets are unset**, so no `terraform apply`
   has ever succeeded and the weekly drift gate has been red since 2026-07-06.
   These are hand-entered bootstrap credentials. Runbook:
   `infra/terraform/README.md`.
3. **Step 6 is untested** — preview deploy, staging, exact-version promotion and
   rollback have not been exercised end to end. Blocked on 1 and 2.
4. **PR #22** (local dev harness, newsletter, D1 — 42 files) is deferred. It
   overlaps `app/sw.js`, `app/map.js` and `test.yml`, and carries the same
   `sw.js` precache bug forward. Rebase it after this pass.

---

## Ordered next steps

1. Preserve the current dirty changes, fetch/review remote state, and recreate
   the release work on a fresh branch from `upstream/main`. Do not merge the
   current checkout directly; it is 21 upstream commits behind.
2. Reconcile the workflow changes with the Terraform-owned GitHub Environments
   and environment-scoped `CLOUDFLARE_API_TOKEN` contract already on upstream.
   Remove obsolete repo-secret fallbacks only as part of the coordinated secret
   cutover.
3. Redesign or tightly gate the `pull_request_target` preview path. It currently
   checks out PR-controlled Worker source and deploys with a secret. Fork and
   untrusted-author PRs must not receive a credentialed deployment path; use a
   trusted-branch policy, required environment approval, or an equivalent
   reviewed boundary.
4. Make production promotion select an explicit staged version ID. The current
   WIP still runs `versions deploy --env production --yes`; local branch
   `claude/fix-promote-version-select` records a known fix that should be
   reviewed against the rebased pipeline.
5. Define automated post-deploy checks for the API root and all four `/v1`
   routes, including a mocked or bounded gardens dependency check. Record the
   deployed version ID and smoke result in the workflow summary.
6. Validate preview deployment, production staging, exact-version promotion,
   and rollback in that order. Keep Pages/API compatibility explicit: deploy
   and verify the Worker before enabling frontend code that requires a new
   endpoint.
7. Fix or formally retire `app/tests/pipeline.test.js`, correct its workflow path,
   and add it to CI if it remains authoritative. It currently reports a failing
   suite but exits successfully, so it is not a reliable gate.
8. Synchronize the README, roadmap, `CLAUDE.md`, environment guide, and session
   handoff after the workflow is proven. Current docs disagree on test counts,
   phase numbering, and whether the Workers API is stubbed or complete.

## Definition of done

The immediate milestone is complete only when all of these gates pass:

- The implementation branch is based on current `upstream/main`, with no stale
  duplicate Terraform plan or accidental unrelated files in its change set.
- PR preview cannot execute unreviewed fork code with a Cloudflare deployment
  token; GitHub Environment protections and least-privilege token scope are
  documented and enforced.
- Production staging records a version ID, promotion deploys that exact ID, and
  rollback selects a known prior version. No ambiguous "latest" promotion is
  possible.
- `node --test app/tests/geo.test.js` and
  `node --test workers/tests/*.test.js` pass on every supported Node matrix entry.
- The E2E suite passes against a local build, and preprod smoke tests pass for
  the frontend gardens layer and all four API endpoints.
- Terraform formatting, validation, drift plan, first-apply/import status, and
  environment-secret cutover are confirmed from the authoritative upstream
  implementation; no secret value appears in logs or committed files.
- A controlled production stage/promote/smoke/rollback rehearsal succeeds, with
  version IDs and workflow links retained as release evidence.
- Documentation reflects the observed release process and the working tree is
  clean after intentional changes are committed.

## Deferred scope

These are valuable, but follow release hardening:

- true point-in-polygon hardiness lookup for `/v1/ecoregion`;
- richer calendar fields backed by sourced agronomic data;
- moving ecoregion/calendar/plants frontend popups from bundled data to API calls;
- `wrangler dev` integration smoke coverage beyond the unit-level handlers;
- PWA/offline field mode, watershed education, and custom organization layers;
- grants/platform expansion and other new map content.

## Risks and open questions

- **Stale baseline:** applying dirty workflow edits here can discard or regress
  21 upstream commits, including the already-merged Terraform work.
- **Preview trust boundary:** `pull_request_target` plus PR-source checkout plus
  a deployment token is high risk until contributor trust and environment
  approval are explicit.
- **Ambiguous promotion:** bare `versions deploy --yes` may not promote the
  intended staged version; an explicit version is required.
- **Coupled releases:** Pages can expose `/v1/gardens` before the corresponding
  Worker is live, breaking that layer during the gap.
- **Live-state uncertainty:** DNS, routes, tokens, imports, Zero Trust rules,
  environment secrets, version history, and rollback behavior were not queried.
- **Misleading test gate:** the pipeline test's setup error is not included in
  CI and, on this machine, did not make the Node process exit nonzero.
- **Documentation drift:** roadmap phase labels and README descriptions lag the
  implementation, which can send the next maintainer toward already-completed
  or superseded work.

## Verification evidence (2026-07-15)

Run from `/Users/edwinlobo/ridge-to-coast`:

| Command | Result |
|---|---|
| `node --test app/tests/geo.test.js` | Exit 0; 335 passed, 0 failed, 43 suites. |
| `node --test workers/tests/*.test.js` | Exit 0; 27 passed, 0 failed. |
| `node --test app/tests/pipeline.test.js` | Process exit 0, but output reports one failing suite: it tries to read nonexistent `app/.github/workflows/update-epa-regions.yml`; 28 tests passed. Treat as failed verification. |
| `node scripts/audit-cloudflare-config.mjs --help` | Exit 0; argument/help path parses. No Cloudflare request was made. |
| `git rev-list --left-right --count HEAD...upstream/main` | `2 21`: current branch has 2 unique commits and lacks 21 upstream commits. |
| `git diff --check` | Run after this document was added; must remain clean before handoff. |

Not run: network-dependent deploy/audit commands, Terraform plan/apply, live
endpoint checks, and Playwright E2E. Historical handoff results are useful
context but are not substituted for a current release verification.
