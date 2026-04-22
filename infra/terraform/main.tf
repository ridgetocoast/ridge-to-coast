terraform {
  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5"
    }
  }

  # Uncomment to store state in Cloudflare R2 after bucket is created:
  # backend "s3" {
  #   bucket                      = "ridgetocoast-tfstate"
  #   key                         = "terraform.tfstate"
  #   region                      = "auto"
  #   skip_credentials_validation = true
  #   skip_metadata_api_check     = true
  #   skip_region_validation      = true
  #   force_path_style            = true
  #   endpoints = {
  #     s3 = "https://${var.cloudflare_account_id}.r2.cloudflarestorage.com"
  #   }
  # }
}

provider "cloudflare" {
  api_token = var.cloudflare_api_token
}

variable "cloudflare_api_token" {
  description = "Cloudflare API token — Workers Scripts:Edit, Pages:Edit, Zone:Edit, R2:Edit"
  type        = string
  sensitive   = true
}

variable "cloudflare_account_id" {
  description = "Cloudflare Account ID (dashboard homepage → right sidebar)"
  type        = string
}

variable "cloudflare_zone_id" {
  description = "Zone ID for ridgetocoast.com (domain overview page → right sidebar)"
  type        = string
}
