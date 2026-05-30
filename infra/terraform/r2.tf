# Cloudflare R2 — object storage.
# `layers`: P4 institutional custom GeoJSON uploads (issue #25). Adopted via
# imports.tf (already exists live).
resource "cloudflare_r2_bucket" "layers" {
  account_id = var.cloudflare_account_id
  name       = "ridgetocoast-layers"
  location   = "ENAM"
}

# The `ridgetocoast-tfstate` bucket backing the S3 state backend is created
# MANUALLY, once, during bootstrap (spec §6/§9) and is deliberately NOT a
# Terraform resource — Terraform cannot manage the bucket that stores its own
# state (chicken/egg). See README "First-apply runbook".
