# Cloudflare R2 — object storage
# Used for P4: institutional custom GeoJSON layer uploads (issue #25)

resource "cloudflare_r2_bucket" "layers" {
  account_id = var.cloudflare_account_id
  name       = "ridgetocoast-layers"
  location   = "ENAM"
}

# Uncomment after creating the bucket manually for first-time state bootstrap:
# resource "cloudflare_r2_bucket" "tfstate" {
#   account_id = var.cloudflare_account_id
#   name       = "ridgetocoast-tfstate"
#   location   = "ENAM"
# }
