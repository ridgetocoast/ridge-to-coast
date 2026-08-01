# Runbook — configuration for D1 and the newsletter

Ordered steps to take `/v1/subscribe` from a fresh clone to a working production
signup. Local first, because every later step can be rehearsed there for free.

CI is **GitHub Actions** — configuration lives in GitHub *Environments*, not in
repo-level secrets. See `infra/terraform/README.md` for the token model.

---

## 0. What lives where

Four different mechanisms hold configuration. Putting a value in the wrong one
is the usual cause of a green deploy that still 500s.

| Value | Kind | Where it lives | Set by |
|---|---|---|---|
| `database_id` | non-secret | `wrangler.toml` `[[env.*.d1_databases]]` — added in step 4, **after** the databases exist | human, from the Terraform output |
| `SITE_ORIGIN`, `MAIL_FROM` | non-secret | `wrangler.toml` `[env.*] vars` | committed |
| `NEWSLETTER_API_KEY` | **secret** | Worker secret, per environment | `wrangler secret put` |
| `IP_HASH_SALT` | **secret** | Worker secret, per environment | `wrangler secret put` |
| `CLOUDFLARE_API_TOKEN` | **secret** | GitHub Environment (`production`/`preview`/`alpha`) | Terraform |
| Bootstrap creds | **secret** | GitHub Environment `infra` | human, by hand |

Worker secrets are **not** GitHub secrets. They are stored in Cloudflare against
the Worker and injected as `env.*` at runtime. A GitHub secret would only be
visible to the workflow, never to the running Worker.

> Never put `NEWSLETTER_API_KEY` in `wrangler.toml`. That file is committed.

---

## 1. Local

Nothing is required to run the site and the API locally:

```bash
./scripts/dev.sh          # app on :8000, /v1/* proxied to wrangler dev on :8787
```

`scripts/dev.sh` applies `infra/d1/schema.sql` to the local SQLite store on
start. `[env.dev]` sets no `SITE_ORIGIN`, so `workers/subscribe.js` builds
confirmation links from the requesting origin and they point back at the dev
server.

**Mail is not sent locally.** With no `NEWSLETTER_API_KEY`, `workers/mailer.js`
logs the confirmation link to the wrangler output instead. That is deliberate —
it makes the whole double opt-in flow testable offline.

### Optional: exercise the real provider locally

Put secrets in `.dev.vars` at the repo root. Wrangler loads it automatically for
`wrangler dev`; it is gitignored.

```bash
cat > .dev.vars <<'EOF'
NEWSLETTER_API_KEY=re_your_test_key
IP_HASH_SALT=any-local-string
EOF
```

Use a provider **test/sandbox** key. A live key here will send real mail from
your laptop.

### Verify

```bash
curl -s -X POST http://localhost:8000/v1/subscribe \
  -H 'Content-Type: application/json' \
  -d '{"email":"you@example.com","consent":true,"zone":"7b","website":""}'
# -> {"status":"pending","message":"Check your inbox for a confirmation link."}

npx wrangler d1 execute DB --env dev --local \
  --command "select address, status from subscribers"
# -> one row, status 'pending'
```

Copy the confirmation link from the wrangler output and open it. The row should
flip to `confirmed`. To start over:

```bash
npx wrangler d1 execute DB --env dev --local \
  --command "delete from subscribers; delete from signup_attempts;"
```

---

## 2. Create the databases (Terraform)

`infra/terraform/d1.tf` declares one database per environment. Terraform owns the
databases; `wrangler.toml` owns the *binding*, matching the split already
documented for Worker routes in `workers.tf`.

> **`terraform apply` is not scoped to D1.** It also evaluates `tokens.tf`, which
> rotates the deploy tokens and rewrites the GitHub Environment secrets that
> carry them, plus `dns.tf` and `pages.tf`. Always read a plan first.

Use the workflow — it holds the `infra` environment credentials:

1. Actions → **Terraform Infra** → *Run workflow* → `plan`
2. Read the output. Expect three `cloudflare_d1_database` creates, plus token
   updates if you are adopting the D1 permission change in step 3. Anything
   touching DNS or Pages is unexpected — stop and investigate.
3. Same workflow → `apply`

To create *only* the databases and leave tokens untouched, run locally with the
bootstrap credentials (see `infra/terraform/README.md`) and target them:

```bash
terraform apply \
  -target=cloudflare_d1_database.subscribers_production \
  -target=cloudflare_d1_database.subscribers_preview \
  -target=cloudflare_d1_database.subscribers_alpha
```

---

## 3. Deploy tokens need D1 permission

This is easy to miss and fails late.

A Worker carrying a `d1_databases` binding cannot be uploaded by a token without
**D1 Edit** — Cloudflare rejects the script — and `wrangler d1 execute --remote`
needs it to apply the schema. `tokens.tf` grants it to `production-deploy` and
`nonprod-deploy`, and `D1 Read` to `audit-readonly` so config audits can see the
binding.

That grant only takes effect once Terraform applies and the rotated token value
lands in each GitHub Environment. **Apply the token change before the first
Worker deploy that carries the binding**, or CI fails with an authorization
error that reads like a bad secret rather than a missing permission.

---

## 4. Add the bindings to `wrangler.toml`

`wrangler.toml` deliberately ships with **no** `d1_databases` block for
`production`, `preview`, or `alpha`. Cloudflare rejects a script upload whose
binding names a database that does not exist:

```
binding DB of type d1 must have a valid `database_id` specified [code: 10021]
```

Because `deploy-workers-preview.yml` deploys the Worker on every pull request, a
placeholder id there breaks the preview deploy for **every** PR, not just the one
introducing it. So the binding is added only once the databases are real.

Read the ids and add one block per environment:

```bash
terraform output -json d1_database_ids
```

```toml
[[env.production.d1_databases]]
binding = "DB"
database_name = "ridgetocoast-production"
database_id = "<id from the output>"
```

These are identifiers, not secrets — they belong in the committed file. Leave
`[env.dev]` as-is; `--local` ignores its id and creates the store on demand.

Until this step is done, `/v1/subscribe` answers 503 in deployed environments
(`workers/subscribe.js` checks for the binding) and the other four endpoints are
unaffected. Local dev is fully working the whole time.

---

## 5. Apply the schema to each remote database

```bash
npx wrangler d1 execute DB --env alpha      --remote --file infra/d1/schema.sql
npx wrangler d1 execute DB --env preview    --remote --file infra/d1/schema.sql
npx wrangler d1 execute DB --env production --remote --file infra/d1/schema.sql
```

`schema.sql` is idempotent (`CREATE TABLE IF NOT EXISTS`), so re-running after a
schema change is safe. Requires a token with D1 Edit — either the bootstrap
token locally, or run it from a workflow using the environment's token.

---

## 6. Set the Worker secrets, per environment

```bash
npx wrangler secret put NEWSLETTER_API_KEY --env alpha
npx wrangler secret put IP_HASH_SALT       --env alpha
# repeat for --env preview and --env production
```

`IP_HASH_SALT` is what makes the stored consent hash non-reversible. Generate a
distinct value per environment and do not rotate it casually — changing it
invalidates the rate-limit table's existing rows (harmless) and makes old consent
hashes non-comparable (a records issue, not a functional one).

```bash
openssl rand -hex 32
```

Confirm what is set, without revealing values:

```bash
npx wrangler secret list --env production
```

If `NEWSLETTER_API_KEY` is missing in a deployed environment, signups still
record a pending row but the confirmation link is only written to the Worker log
— nobody ever gets mail. Check this before announcing the list.

---

## 7. Deploy and verify, alpha first

`docs/project-status.md` asks for release hardening before new product scope, so
prove the whole path on alpha before any production promotion.

1. Actions → **Deploy API** → `workflow_dispatch` → environment `alpha`
2. Smoke it:

```bash
curl -s https://alpha.ridgetocoast.com/ | jq .endpoints
# must include /v1/subscribe

curl -s -o /dev/null -w '%{http_code}\n' -X POST \
  https://alpha.ridgetocoast.com/v1/subscribe \
  -H 'Content-Type: application/json' \
  -d '{"email":"you+alpha@example.com","consent":true,"website":""}'
# 202
```

3. Confirm the mail actually arrived, follow the link, and check the row:

```bash
npx wrangler d1 execute DB --env alpha --remote \
  --command "select address, status, confirmed_at from subscribers"
```

4. Follow the unsubscribe link from the message footer and confirm the row moves
   to `unsubscribed`.

Only then: push to `main` to stage a production version, promote via
**Promote / Rollback Workers API**, and repeat the smoke against
`api.ridgetocoast.com`.

Note both `preprod` and `alpha` are behind Cloudflare Zero Trust IP allowlisting,
so these curls need an allowlisted address.

---

## Troubleshooting

| Symptom | Cause |
|---|---|
| `binding DB of type d1 must have a valid database_id` (code 10021) | A `d1_databases` block names a database that does not exist. Either finish step 2 or remove the block — see step 4 |
| Deploy fails with an authorization error mentioning bindings | Deploy token lacks D1 Edit — step 3 not applied yet |
| `/v1/subscribe` returns 503 | No `DB` binding resolved: step 4 not done for that environment |
| 202 but no mail arrives | `NEWSLETTER_API_KEY` unset for that environment — check the Worker log for the link |
| 502 on signup | Provider rejected the send; the row is still pending. Check the key and the `MAIL_FROM` domain is verified |
| Confirmation link 404s | `SITE_ORIGIN` points at a host that serves no static files |
| Local signup works, deployed does not | Almost always a secret set locally in `.dev.vars` but never `wrangler secret put` for that environment |

---

## Related

- `infra/terraform/README.md` — token model, bootstrap credentials, first-apply
- `app/docs/environments.md` — environments, local dev server, deploy flow
- `CLAUDE.md` — GitHub Environment secret table
