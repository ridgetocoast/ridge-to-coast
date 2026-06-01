terraform {
  required_version = ">= 1.11"

  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5"
    }
    github = {
      source  = "integrations/github"
      version = "~> 6"
    }
    time = {
      source  = "hashicorp/time"
      version = "~> 0.12"
    }
  }

  # R2 (S3-compatible) backend. Mandatory: tfstate holds sensitive token values
  # (Decision 10). Native lockfile (use_lockfile) replaces DynamoDB — needs
  # Terraform >= 1.11. Backends cannot interpolate var.*, so the account id
  # (not secret, Decision 7) is the literal below; R2 access key/secret are
  # supplied at init via `-backend-config` / AWS_* env (see README).
  backend "s3" {
    bucket = "ridgetocoast-tfstate"
    key    = "terraform.tfstate"
    region = "auto"

    endpoints = {
      s3 = "https://c378aeb8ad614074b3a5e541a4788993.r2.cloudflarestorage.com"
    }

    use_lockfile                = true
    skip_credentials_validation = true
    skip_metadata_api_check     = true
    skip_region_validation      = true
    skip_requesting_account_id  = true
    skip_s3_checksum            = true
    force_path_style            = true
  }
}

provider "cloudflare" {
  api_token = var.cloudflare_bootstrap_token
}

provider "github" {
  owner = "ridgetocoast"
  token = var.github_token
}

provider "time" {}

# ---- Non-secret ids (safe to commit; Decision 7) ----

variable "cloudflare_account_id" {
  description = "Cloudflare Account ID — not sensitive, safe to commit"
  type        = string
  default     = "c378aeb8ad614074b3a5e541a4788993"
}

variable "cloudflare_zone_id" {
  description = "Zone ID for ridgetocoast.com — not sensitive, safe to commit"
  type        = string
  default     = "77d12978a2a1395b87a12be147f3b5e9"
}

# ---- Bootstrap root-of-trust (manual, never TF-managed; spec §6) ----

variable "cloudflare_bootstrap_token" {
  description = "CF bootstrap token: Account API Tokens:Edit + edit scopes of all TF-managed resources (DNS, Pages, Workers, R2, Account DNS Settings). Manually created, ~annual manual rotation."
  type        = string
  sensitive   = true
}

variable "github_token" {
  description = "GitHub PAT/App token: repo Administration + Actions Secrets read/write. Manually created, ~annual manual rotation."
  type        = string
  sensitive   = true
}

variable "r2_access_key_id" {
  description = "R2 S3 access key id for the state backend. Manually created. Stub variable for tfvars-example completeness — the value is NOT consumed by any HCL resource; pass it to `terraform init -backend-config` or as AWS_ACCESS_KEY_ID env var (CI uses the env path)."
  type        = string
  sensitive   = true
  default     = ""
}

variable "r2_secret_access_key" {
  description = "R2 S3 secret access key for the state backend. Manually created. Stub variable for tfvars-example completeness — the value is NOT consumed by any HCL resource; pass it to `terraform init -backend-config` or as AWS_SECRET_ACCESS_KEY env var (CI uses the env path)."
  type        = string
  sensitive   = true
  default     = ""
}
