# Cloudflare R2 — object storage
# Used for P4: institutional custom GeoJSON layer uploads

resource "cloudflare_r2_bucket" "layers" {
  account_id = var.cloudflare_account_id
  name       = "ridgetocoast-layers"
  location   = "ENAM"  # Eastern North America
}

# Terraform state bucket (uncomment after first manual creation)
# resource "cloudflare_r2_bucket" "tfstate" {
#   account_id = var.cloudflare_account_id
#   name       = "ridgetocoast-tfstate"
#   location   = "ENAM"
# }
