terraform {
  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.0"
    }
  }

  # Store state in Cloudflare R2 (free) once bucket exists
  # backend "s3" {
  #   bucket                      = "ridgetocoast-tfstate"
  #   key                         = "terraform.tfstate"
  #   region                      = "auto"
  #   skip_credentials_validation = true
  #   skip_metadata_api_check     = true
  #   skip_region_validation      = true
  #   force_path_style            = true
  #   endpoints = {
  #     s3 = "https://YOUR_CLOUDFLARE_ACCOUNT_ID.r2.cloudflarestorage.com"
  #   }
  # }
}

provider "cloudflare" {
  # Set via CLOUDFLARE_API_TOKEN environment variable
  # Token needs: Workers Scripts:Edit, Pages:Edit, Zone:Edit, R2:Edit
}

variable "cloudflare_account_id" {
  description = "Cloudflare Account ID (from dashboard homepage)"
  type        = string
  # Set via TF_VAR_cloudflare_account_id or terraform.tfvars
}

variable "cloudflare_zone_id" {
  description = "Cloudflare Zone ID for ridgetocoast.com (from domain dashboard)"
  type        = string
}
