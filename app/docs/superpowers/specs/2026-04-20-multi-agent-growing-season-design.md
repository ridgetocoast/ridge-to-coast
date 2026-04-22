# Design: Multi-Agent Dev System + Growing Season MVP

**Date:** 2026-04-20  
**Status:** Approved  
**App:** Ridge to Coast (loobo07.github.io)

---

## Problem

Ridge to Coast is a mature ecological map but is currently a static reference tool. The owner wants to:
1. Add real-time seasonal intelligence so users can act on their land today
2. Scale development velocity using a Claude Code multi-agent system
3. Expand geographic coverage east of the Mississippi in parallel

---

## Multi-Agent Development System

### Constraint

Owner uses Claude Pro (web) — no Anthropic API key. AWS Bedrock is available but unused. Multi-agent workflows run locally via Claude Code CLI today; GitHub Actions automation activates when Bedrock is configured.

### Agent Roles

| Role | Model | Trigger |
|------|-------|---------|
| Planner | `claude-haiku-4-5-20251001` | `agent:plan` label |
| Architect | `claude-opus-4-7` | `agent:architect` label |
| Senior Engineer | `claude-opus-4-7` | `agent:implement-hard` label |
| Engineer | `claude-sonnet-4-6` | `agent:implement` label |
| Design/CSS/docs | `claude-sonnet-4-6` | `agent:design` label |

### Local Workflow (Today)

```
gh issue create --title "feat: frost advisory" --label "agent:plan"
  ↓
git worktree add ../ridge-issue-N -b claude/issue-N-frost-advisory
  ↓
claude --model claude-opus-4-7   # in worktree
  ↓ (reference .claude/agents/architect.md)
node --test tests/geo.test.js    # must pass
  ↓
gh pr create
```

### Bedrock Activation Path (Future)

1. AWS Console → Bedrock → request model access (claude-haiku, claude-sonnet, claude-opus in us-east-1)
2. Create IAM role with `bedrock:InvokeModel` permission, trust GitHub OIDC
3. Add `AWS_ROLE_ARN` to GitHub repo variables
4. Activate `.github/workflows/agent-pipeline.yml` (currently stub)

**Estimated cost per full feature PR:** ~$1.00 (Haiku planner + Opus architect + Sonnet engineer)

---

## Growing Season MVP

### Feature: Seasonal Intelligence Card

Displayed when a user searches their location, above the existing location report.

**Data sources (all free, no API keys):**

| Panel | Source | Notes |
|-------|--------|-------|
| Frost Risk | NWS `api.weather.gov` | `/points/{lat},{lon}` → active alerts endpoint |
| Plant Now | Existing `PLANTING_CALENDAR` in `lib/geo-data.js:1664` | Filter to current month + user's zone |
| In Your Region | iNaturalist API v1 | Observations bbox last 30 days |
| Rivers | USGS Water Services REST | Nearest gauge by bbox, parameter 00060 (discharge) |

**CSP additions needed in `index.html`:**
- `https://api.weather.gov`
- `https://api.inaturalist.org`
- `https://waterservices.usgs.gov`

### New Functions (in `lib/geo-data.js`)

All new functions appended after existing exports (~line 3987).

```js
async fetchFrostAdvisory(lat, lon)         // → {active, expires, headline}
async fetchINatObservations(bbox)           // → [{name, commonName, count}]
async fetchUSGSStreamflow(bbox)             // → [{siteName, value, unitCode}]
getCurrentPlantingActivities(zone)          // sync, reads PLANTING_CALENDAR
async makeSeasonalCard(zone, region, lat, lon) // → HTML string
```

`makeSeasonalCard` calls the three async fetches in parallel via `Promise.allSettled` (graceful degradation if any API is unavailable).

### Integration (in `map.js`)

In the `#detail/location/...` hash route handler (lines 23–90), call `makeSeasonalCard()` and prepend the result above the existing location report HTML.

### Error Handling

Each API fetch wrapped in try/catch. If a source fails, its panel shows a "data unavailable" message rather than breaking the card. The card always renders.

---

## Geographic Expansion

Extend from 22-state Appalachian corridor to all states east of the Mississippi River:

1. Update bbox constant in `scripts/process-hardiness.js` to `[-91.5, 24.5, -66.9, 49.0]`
2. Add ~30 cities to `CORRIDOR_CITIES` array in `lib/geo-data.js:3033` covering Great Lakes, Midwest, and Gulf states
3. Extend region polygon boundaries in `lib/geo-data.js` to reach Mississippi River

---

## Test Requirements

- All new `fetch*` functions must have unit tests with mocked fetch responses in `tests/geo.test.js`
- `makeSeasonalCard` must be tested with all APIs failing (graceful degradation)
- `getCurrentPlantingActivities` must be tested against existing PLANTING_CALENDAR data
- E2E: search "Richmond VA" → seasonal card appears in DOM
- E2E: seasonal card renders when all APIs return errors
