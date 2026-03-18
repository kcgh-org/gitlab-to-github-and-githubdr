#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# CONFIG (kept same style as your Azure script)
# ============================================================
API_BASE_URL="${GH_API_URL}"   # user requested base URL
GITHUB_API_VERSION="2022-11-28"
SAS_EXPIRY_HOURS="${SAS_EXPIRY_HOURS:-24}" # default 24 hours

# ============================================================
# REQUIRED ENV VARS (GitHub + archive + AWS)
# ============================================================
required_vars=("GH_ORG" "TARGET_GH_REPO" "GH_PAT" "AWS_ACCESS_KEY_ID" "AWS_SECRET_ACCESS_KEY" "AWS_REGION" "AWS_BUCKET_NAME")

for var in "${required_vars[@]}"; do
  if [[ -z "${!var:-}" ]]; then
    echo "Error: Required environment variable $var is not set"
    exit 1
  fi
done

# Dependencies (Azure script already assumes jq; keep same expectation)
for bin in curl openssl jq od date; do
  if ! command -v "$bin" >/dev/null 2>&1; then
    echo "Error: Required command '$bin' is not installed"
    exit 1
  fi
done

# ============================================================
# FUNCTIONS
# ============================================================

get_org_id() {
  local org_slug="$1"
  local gh_pat="$2"
  local api_url="${API_BASE_URL%/}/orgs/${org_slug}"

  echo "Fetching org id from: ${api_url}"

  ORG_ID="$(
    curl -sS \
      -H "Authorization: Bearer ${gh_pat}" \
      -H "Accept: application/vnd.github+json" \
      -H "X-GitHub-Api-Version: ${GITHUB_API_VERSION}" \
      "${api_url}" | jq -r '.id'
  )"

  echo "Organization ID: ${ORG_ID}"

  if [[ -z "${ORG_ID}" || "${ORG_ID}" == "null" ]]; then
    echo "Error: Failed to get organization ID from API: ${api_url}"
    exit 1
  fi
}

# ---- SigV4 helpers (no awscli) ----
to_hex() { od -An -vtx1 | tr -d ' \n'; }

sha256_hex_string() {
  # stdin -> sha256 hex
  openssl dgst -sha256 -hex | awk '{print $2}'
}

sha256_hex_file() {
  local f="$1"
  openssl dgst -sha256 -hex "$f" | awk '{print $2}'
}

hmac_sha256_hexkey_to_hex() {
  # args: <hexkey> <data>
  local hexkey="$1"
  local data="$2"
  printf "%s" "$data" | openssl dgst -sha256 -mac HMAC -macopt "hexkey:${hexkey}" -binary | to_hex
}

hmac_sha256_rawkey_to_hex() {
  # args: <rawkey> <data>
  local rawkey="$1"
  local data="$2"
  printf "%s" "$data" | openssl dgst -sha256 -mac HMAC -macopt "key:${rawkey}" -binary | to_hex
}

sigv4_derive_signing_key_hex() {
  # returns signing key hex for <date>/<region>/s3/aws4_request
  local date_stamp="$1"
  local region="$2"
  local secret="$3"

  local k_secret="AWS4${secret}"
  local k_date_hex
  local k_region_hex
  local k_service_hex
  local k_signing_hex

  k_date_hex="$(hmac_sha256_rawkey_to_hex "${k_secret}" "${date_stamp}")"
  k_region_hex="$(hmac_sha256_hexkey_to_hex "${k_date_hex}" "${region}")"
  k_service_hex="$(hmac_sha256_hexkey_to_hex "${k_region_hex}" "s3")"
  k_signing_hex="$(hmac_sha256_hexkey_to_hex "${k_service_hex}" "aws4_request")"

  printf "%s" "${k_signing_hex}"
}

sigv4_sign_hex() {
  # args: <signing_key_hex> <string_to_sign> -> signature hex
  local signing_key_hex="$1"
  local sts="$2"
  printf "%s" "$sts" | openssl dgst -sha256 -mac HMAC -macopt "hexkey:${signing_key_hex}" -hex | awk '{print $2}'
}

urlencode_slash() {
  # only encode "/" -> "%2F" (enough for X-Amz-Credential)
  sed 's|/|%2F|g'
}

upload_archive_to_aws_s3() {
  local org_id="$1"
  local repo_name="$2"

  local archive_file="${repo_name}.tar.gz"

  # Look for the archive in root directory (same pattern as your script)
  cd /
  echo "Looking for archive file at: $PWD/$archive_file"

  if [[ ! -f "$archive_file" ]]; then
    echo "Error: Archive file not found at $PWD/$archive_file"
    ls -la
    exit 1
  fi

  local bucket="${AWS_BUCKET_NAME}"
  local region="${AWS_REGION}"
  local access_key="${AWS_ACCESS_KEY_ID}"
  local secret_key="${AWS_SECRET_ACCESS_KEY}"

  # S3 key path same pattern as Azure blob_name: "${org_id}/${archive_file}"
  local s3_key="${org_id}/${archive_file}"

  # Virtual-hosted style endpoint
  local host="${bucket}.s3.${region}.amazonaws.com"
  local canonical_uri="/${s3_key}"
  local url="https://${host}${canonical_uri}"

  echo "Uploading to AWS S3..."
  echo "  Bucket   : ${bucket}"
  echo "  Object   : ${s3_key}"
  echo "  Endpoint : ${url}"

  # Dates (UTC)
  local amz_date
  local date_stamp
  amz_date="$(date -u +"%Y%m%dT%H%M%SZ")"
  date_stamp="$(date -u +"%Y%m%d")"

  # Payload hash (required for S3 SigV4 header signing)
  local payload_hash
  payload_hash="$(sha256_hex_file "${archive_file}")"

  # Canonical request
  local canonical_headers
  local signed_headers
  canonical_headers="host:${host}\nx-amz-content-sha256:${payload_hash}\nx-amz-date:${amz_date}\n"
  signed_headers="host;x-amz-content-sha256;x-amz-date"

  local canonical_request
  canonical_request="PUT
${canonical_uri}

${canonical_headers}
${signed_headers}
${payload_hash}"

  local canonical_request_hash
  canonical_request_hash="$(printf "%s" "${canonical_request}" | sha256_hex_string)"

  # String to sign
  local algorithm="AWS4-HMAC-SHA256"
  local credential_scope="${date_stamp}/${region}/s3/aws4_request"
  local string_to_sign
  string_to_sign="${algorithm}
${amz_date}
${credential_scope}
${canonical_request_hash}"

  # Signature
  local signing_key_hex
  signing_key_hex="$(sigv4_derive_signing_key_hex "${date_stamp}" "${region}" "${secret_key}")"

  local signature
  signature="$(sigv4_sign_hex "${signing_key_hex}" "${string_to_sign}")"

  local authorization
  authorization="${algorithm} Credential=${access_key}/${credential_scope}, SignedHeaders=${signed_headers}, Signature=${signature}"

  # Upload
  local http_code
  http_code="$(
    curl -sS -o /tmp/s3_upload_resp.$$ -w "%{http_code}" \
      -X PUT "${url}" \
      -H "Authorization: ${authorization}" \
      -H "x-amz-date: ${amz_date}" \
      -H "x-amz-content-sha256: ${payload_hash}" \
      --data-binary @"${archive_file}" \
      || true
  )"

  if [[ "${http_code}" =~ ^2[0-9][0-9]$ ]]; then
    echo "Upload complete. (HTTP ${http_code})"
    rm -f /tmp/s3_upload_resp.$$ >/dev/null 2>&1 || true
  else
    echo "Error: Upload failed (HTTP ${http_code})"
    echo "Response (if any):"
    cat /tmp/s3_upload_resp.$$ || true
    rm -f /tmp/s3_upload_resp.$$ >/dev/null 2>&1 || true
    exit 1
  fi

  echo "Generating pre-signed URL..."

  # Presigned URL uses query parameters (SigV4 query-string auth). [2](https://docs.aws.amazon.com/AmazonS3/latest/API/sigv4-query-string-auth.html)
  local expires
  expires="$((SAS_EXPIRY_HOURS * 3600))"

  echo "  URL expiry: ${SAS_EXPIRY_HOURS} hour(s) (${expires} seconds)"

  # Query params (must be URL encoded where needed; credential needs "/" encoded) [2](https://docs.aws.amazon.com/AmazonS3/latest/API/sigv4-query-string-auth.html)
  local x_amz_algorithm="AWS4-HMAC-SHA256"
  local x_amz_credential_raw="${access_key}/${credential_scope}"
  local x_amz_credential_enc
  x_amz_credential_enc="$(printf "%s" "${x_amz_credential_raw}" | urlencode_slash)"

  local x_amz_date="${amz_date}"
  local x_amz_signedheaders="host"

  # Canonical query string (sorted)
  local canonical_qs
  canonical_qs="X-Amz-Algorithm=${x_amz_algorithm}&X-Amz-Credential=${x_amz_credential_enc}&X-Amz-Date=${x_amz_date}&X-Amz-Expires=${expires}&X-Amz-SignedHeaders=${x_amz_signedheaders}"

  # For presigned GET, payload is empty -> SHA256("").
  local empty_payload_hash
  empty_payload_hash="$(printf "%s" "" | sha256_hex_string)"

  local presign_canonical_request
  presign_canonical_request="GET
${canonical_uri}
${canonical_qs}
host:${host}

${x_amz_signedheaders}
${empty_payload_hash}"

  local presign_canonical_request_hash
  presign_canonical_request_hash="$(printf "%s" "${presign_canonical_request}" | sha256_hex_string)"

  local presign_string_to_sign
  presign_string_to_sign="${algorithm}
${x_amz_date}
${credential_scope}
${presign_canonical_request_hash}"

  local presign_signature
  presign_signature="$(sigv4_sign_hex "${signing_key_hex}" "${presign_string_to_sign}")"

  PRESIGNED_URL="https://${host}${canonical_uri}?${canonical_qs}&X-Amz-Signature=${presign_signature}"
  export PRESIGNED_URL

  echo "PRESIGNED_URL=${PRESIGNED_URL}"
  echo "Archive Upload URL: ${PRESIGNED_URL}"

  # If running inside GitHub Actions, persist for next steps
  if [[ -n "${GITHUB_ENV:-}" ]]; then
    echo "PRESIGNED_URL=${PRESIGNED_URL}" >> "$GITHUB_ENV"
    echo "Wrote PRESIGNED_URL to GITHUB_ENV."
  fi
}

main() {
  get_org_id "$GH_ORG" "$GH_PAT"
  upload_archive_to_aws_s3 "$ORG_ID" "$TARGET_GH_REPO"
}

main "$@"
