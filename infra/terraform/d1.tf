# Cloudflare D1 — newsletter subscriber store for /v1/subscribe.
#
# Terraform owns the databases; the Worker *binding* to them lives in
# wrangler.toml because Wrangler reasserts bindings on every deploy. This is the
# same ownership split already documented for Worker routes in workers.tf — the
# pipeline sub-project is where that boundary gets reconciled.
#
# The schema is NOT applied here. Terraform has no D1 query resource, so
# infra/d1/schema.sql is applied with:
#   npx wrangler d1 execute DB --env <env> --remote --file infra/d1/schema.sql
# It is idempotent, so re-running it after a schema change is safe.

resource "cloudflare_d1_database" "subscribers_production" {
  account_id = var.cloudflare_account_id
  name       = "ridgetocoast-production"
}

resource "cloudflare_d1_database" "subscribers_preview" {
  account_id = var.cloudflare_account_id
  name       = "ridgetocoast-preview"
}

resource "cloudflare_d1_database" "subscribers_alpha" {
  account_id = var.cloudflare_account_id
  name       = "ridgetocoast-alpha"
}

# Paste these into the matching `database_id` fields in wrangler.toml after the
# first apply. They are identifiers, not secrets.
output "d1_database_ids" {
  description = "D1 database ids to copy into wrangler.toml [[env.*.d1_databases]]."
  value = {
    production = cloudflare_d1_database.subscribers_production.id
    preview    = cloudflare_d1_database.subscribers_preview.id
    alpha      = cloudflare_d1_database.subscribers_alpha.id
  }
}

# TODO(subproject-2): Worker secrets. NEWSLETTER_API_KEY and IP_HASH_SALT are set
# by hand with `wrangler secret put --env <env>` for now. Moving them into
# Terraform means giving the deploy token Workers Scripts:Edit on secrets and
# storing the provider key in tfvars, which needs the same review as the token
# rotation work in tokens.tf. Tracked with the route-ownership item in workers.tf.
