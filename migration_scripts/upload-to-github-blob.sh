#!/usr/bin/env bash

# Script to upload GitLab repository archive to GitHub
# Usage: ./upload-to-github-blob.sh

set -euo pipefail

# Validate required environment variables
required_vars=("GH_ORG" "TARGET_GH_REPO" "GH_PAT")
for var in "${required_vars[@]}"; do
  if [[ -z "${!var:-}" ]]; then
    echo "Error: Required environment variable $var is not set"
    exit 1
  fi
done

get_org_id() {
  local org_slug="$1"
  local gh_pat="$2"

  ORG_ID=$(curl --silent -H "Authorization: Bearer $gh_pat" \
    -H "Content-Type: application/json" \
    https://api.github.com/orgs/$org_slug | jq -r '.id')

  echo "Organization ID: $ORG_ID"
  if [[ -z "$ORG_ID" || "$ORG_ID" == "null" ]]; then
    echo "Error: Failed to get organization ID from GitHub API"
    exit 1
  fi

}

upload_archive() {
  local org_id="$1"
  local repo_name="$2"
  local archive_file="${repo_name}.tar.gz"
  local gh_pat="$3"

  # Look for the archive in root directory
  cd /

  echo "Looking for archive file at: $PWD/$archive_file"

  if [[ ! -f "$archive_file" ]]; then
    echo "Error: Archive file not found at $PWD/$archive_file"
    ls -la
    exit 1
  fi

  local response
  response=$(curl -s -X POST \
    -H "Authorization: Bearer $gh_pat" \
    -H "Content-Type: application/octet-stream" \
    -T "${archive_file}" \
    "https://uploads.github.com/organizations/${org_id}/gei/archive?name=${archive_file}")

  echo "Archive Upload Response: $response"

  local upload_uri
  upload_uri=$(echo "$response" | jq -r '.uri')

  if [[ -z "$upload_uri" || "$upload_uri" == "null" ]]; then
    echo "Error: Failed to get valid upload URL from response"
    exit 1
  fi

  echo "Archive Upload URL: $upload_uri"
  echo "PRESIGNED_URL=$upload_uri" >>"$GITHUB_ENV"
}

main() {
  get_org_id "$GH_ORG" "$GH_PAT"
  upload_archive "$ORG_ID" "$TARGET_GH_REPO" "$GH_PAT"
}

main "$@"
