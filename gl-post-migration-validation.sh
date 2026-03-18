#!/usr/bin/env bash
set -euo pipefail

# -------------------------
# Config / env
# -------------------------
INVENTORY_FILE="${INVENTORY_FILE:-}"     # REQUIRED: GitLab inventory CSV (gitlab-stats output + mapping cols)
OUTPUT_DIR="gl2gh-migration-validation-outputs"
RUN_TS="$(date +"%Y%m%d_%H%M%S")"
LOG_FILE="${OUTPUT_DIR}/validation-log_${RUN_TS}.log"
SUMMARY_CSV="${OUTPUT_DIR}/validation-summary_${RUN_TS}.csv"
SUMMARY_MD="${OUTPUT_DIR}/validation-summary_${RUN_TS}.md"

mkdir -p "${OUTPUT_DIR}"

# -------------------------
# Pre-flight checks
# -------------------------
command -v gh >/dev/null 2>&1 || { echo "ERROR: GitHub CLI (gh) not found" >&2; exit 1; }
command -v jq >/dev/null 2>&1 || { echo "ERROR: jq not found" >&2; exit 1; }
command -v python3 >/dev/null 2>&1 || { echo "ERROR: python3 not found" >&2; exit 1; }

if [[ -z "${INVENTORY_FILE}" ]]; then echo "ERROR: INVENTORY_FILE is not set" >&2; exit 1; fi
if [[ ! -f "${INVENTORY_FILE}" ]]; then echo "ERROR: INVENTORY_FILE not found: ${INVENTORY_FILE}" >&2; exit 1; fi

if [[ -z "${GH_TOKEN:-}" && -n "${GH_PAT:-}" ]]; then
  export GH_TOKEN="${GH_PAT}"
fi

# If neither env token exists, require stored gh auth login
if [[ -z "${GH_TOKEN:-}" && -z "${GITHUB_TOKEN:-}" ]]; then
  if ! gh auth status >/dev/null 2>&1; then
    echo "ERROR: GitHub CLI not authenticated." >&2
    echo "       Set GH_TOKEN (preferred) or GH_PAT, or run: gh auth login" >&2
    exit 1
  fi
fi

# Sanity check: auth works for API calls
if ! gh api -X GET /user >/dev/null 2>&1; then
  echo "ERROR: GitHub auth check failed (cannot call /user)." >&2
  echo "       Verify GH_TOKEN/GH_PAT/GITHUB_TOKEN scopes and SSO authorization if applicable." >&2
  exit 1
fi

echo "[INFO] Starting GitLab -> GitHub validation (Inventory-only)"
echo "[INFO] Inventory: ${INVENTORY_FILE}"
echo "[INFO] Output Dir: ${OUTPUT_DIR}"
echo "[INFO] Log File  : ${LOG_FILE}"
echo "[INFO] Summary   : ${SUMMARY_CSV}"

# -------------------------
# Output header
# -------------------------
printf 'github_org,github_repo,gitlab_namespace,gitlab_project,github_repo_exists,exists_status,github_branch_count,branches_status,github_default_branch,default_branch_status,github_commit_count_default_branch,commits_status,github_latest_sha_default_branch,gitlab_branch_count,branch_count_match,gitlab_commit_count,commit_count_match,notes\n' > "${SUMMARY_CSV}"

# -------------------------
# Helpers
# -------------------------
dequote() {
  local field="${1:-}"
  field="${field%$'\r'}"
  field="${field%\"}"
  field="${field#\"}"
  echo "${field}"
}

header="$(head -n 1 "${INVENTORY_FILE}" | tr -d $'\r')"
IFS=',' read -r -a cols <<< "${header}"

find_col() {
  local name="$1"
  for i in "${!cols[@]}"; do
    [[ "$(dequote "${cols[$i]}")" == "$name" ]] && { echo "$i"; return 0; }
  done
  return 1
}

# -------------------------
# Column indices (required)
# -------------------------
NS_IDX="$(find_col "Namespace")"      || { echo "[ERROR] Missing header: Namespace" >&2; exit 1; }
PR_IDX="$(find_col "Project")"        || { echo "[ERROR] Missing header: Project" >&2; exit 1; }
BC_IDX="$(find_col "Branch_Count")"   || { echo "[ERROR] Missing header: Branch_Count" >&2; exit 1; }
CC_IDX="$(find_col "Commit_Count")"   || { echo "[ERROR] Missing header: Commit_Count" >&2; exit 1; }
GH_ORG_IDX="$(find_col "github_org")" || { echo "[ERROR] Missing header: github_org" >&2; exit 1; }
GH_REPO_IDX="$(find_col "github_repo")" || { echo "[ERROR] Missing header: github_repo" >&2; exit 1; }

# -------------------------
# Iterate inventory rows
# -------------------------
tail -n +2 "${INVENTORY_FILE}" | while IFS= read -r raw; do
  line="$(echo "$raw" | tr -d $'\r')"
  [[ -z "$line" ]] && continue

  IFS=',' read -r -a flds <<< "${line}"

  gitlab_namespace="$(dequote "${flds[$NS_IDX]:-}")"
  gitlab_project="$(dequote "${flds[$PR_IDX]:-}")"
  gitlab_branch_count="$(dequote "${flds[$BC_IDX]:-}")"
  gitlab_commit_count="$(dequote "${flds[$CC_IDX]:-}")"

  github_org="$(dequote "${flds[$GH_ORG_IDX]:-}")"
  github_repo_from_inv="$(dequote "${flds[$GH_REPO_IDX]:-}")"

  # Normalize empties
  [[ -z "${gitlab_branch_count}" ]] && gitlab_branch_count=0
  [[ -z "${gitlab_commit_count}" ]] && gitlab_commit_count=0

  # Guard
  if [[ -z "$gitlab_namespace" || -z "$gitlab_project" || -z "$github_org" || -z "$github_repo_from_inv" ]]; then
    echo "[$(date)] [SKIP] Missing Namespace/Project/github_org/github_repo: $line" | tee -a "${LOG_FILE}"
    continue
  fi

  # Target GitHub repo name is taken from inventory github_repo column
  github_repo="${github_repo_from_inv}"

  echo "[$(date)] ▶ Processing: GitLab ${gitlab_namespace}/${gitlab_project} -> GitHub ${github_org}/${github_repo}" | tee -a "${LOG_FILE}"

  # Snapshot
  gh repo view "${github_org}/${github_repo}" --json createdAt,diskUsage,defaultBranchRef,isPrivate \
    > "${OUTPUT_DIR}/validation-${github_repo}.json" 2>/dev/null || true

  # Existence
  if gh api -X GET "/repos/${github_org}/${github_repo}" >/dev/null 2>&1; then
    github_repo_exists=true; exists_status="✅"
  else
    github_repo_exists=false; exists_status="❌"
  fi

  notes=""
  github_branch_count=0
  github_default_branch=""
  github_commit_count_default_branch=0
  github_latest_sha_default_branch=""
  branches_status="❌"
  default_branch_status="❌"
  commits_status="❌"

  if [[ "${github_repo_exists}" == true ]]; then
    # Branches
    github_branches_json=$(gh api "/repos/${github_org}/${github_repo}/branches" --paginate \
      | jq -r '.[].name' | jq -R -s -c 'split("\n") | map(select(length>0))')
    github_branch_count=$(printf '%s' "$github_branches_json" | jq 'length')
    branches_status=$([[ "$github_branch_count" -gt 0 ]] && echo "✅" || echo "❌")

    # Default branch
    github_default_branch=$(gh api "/repos/${github_org}/${github_repo}" | jq -r '.default_branch // ""')
    default_branch_status=$([[ -n "$github_default_branch" ]] && echo "✅" || echo "❌")

    # Commits on default branch
    if [[ -n "$github_default_branch" ]]; then
      total=0; latest=""; page=1; per=100
      while :; do
        enc_branch="$(python3 -c 'import urllib.parse,sys;print(urllib.parse.quote(sys.argv[1]))' "$github_default_branch")"
        chunk="$(gh api "/repos/${github_org}/${github_repo}/commits?sha=${enc_branch}&page=${page}&per_page=${per}" | jq -c '.')"
        cnt="$(printf '%s' "$chunk" | jq 'length')"
        if [[ "$page" -eq 1 && "$cnt" -gt 0 ]]; then
          latest="$(printf '%s' "$chunk" | jq -r '.[0].sha')"
        fi
        total=$((total + cnt))
        if [[ "$cnt" -eq "$per" ]]; then page=$((page+1)); else break; fi
      done

      github_commit_count_default_branch="$total"
      github_latest_sha_default_branch="$latest"
      commits_status=$([[ "$github_commit_count_default_branch" -gt 0 ]] && echo "✅" || echo "❌")
    else
      notes="No default branch on GitHub"
    fi
  else
    notes="GitHub repository not found or no access"
  fi

  # Match checks
  branch_count_match=$([[ "$github_branch_count" -eq "$gitlab_branch_count" ]] && echo "✅" || echo "❌")
  commit_count_match=$([[ "$github_commit_count_default_branch" -eq "$gitlab_commit_count" ]] && echo "✅" || echo "❌")

  # Logs
  echo "[$(date)]   Exists: ${exists_status} | Branches: ${github_branch_count} ${branches_status}" | tee -a "${LOG_FILE}"
  echo "[$(date)]   Default Branch: ${github_default_branch:-'(none)'} ${default_branch_status}" | tee -a "${LOG_FILE}"
  echo "[$(date)]   Commits (Default Branch): ${github_commit_count_default_branch} ${commits_status}" | tee -a "${LOG_FILE}"
  [[ -n "$github_latest_sha_default_branch" ]] && echo "[$(date)]   Latest SHA (Default Branch): ${github_latest_sha_default_branch}" | tee -a "${LOG_FILE}"
  echo "[$(date)]   Match: Branch ${branch_count_match} | Commit ${commit_count_match}" | tee -a "${LOG_FILE}"

  # Write CSV row
  printf '%s\n' \
    "${github_org},${github_repo},${gitlab_namespace},${gitlab_project},${github_repo_exists},${exists_status},${github_branch_count},${branches_status},${github_default_branch},${default_branch_status},${github_commit_count_default_branch},${commits_status},${github_latest_sha_default_branch},${gitlab_branch_count},${branch_count_match},${gitlab_commit_count},${commit_count_match},${notes}" \
    >> "${SUMMARY_CSV}"

done

echo "[INFO] Validation completed."
echo "[INFO] Artifacts: ${LOG_FILE}, ${SUMMARY_CSV}"

# -------------------------
# Markdown summary
# -------------------------
{
  echo "# Post-Migration Validation Summary"
  echo
  echo "| GitHub Repo | GitLab Project | Exists | GH Branches | GL Branches | Branch Match | GH Default Branch | GH Commits (Default) | GL Commits | Commit Match | Notes |"
  echo "|---|---|---|---:|---:|---|---|---:|---:|---|---|"

  tail -n +2 "${SUMMARY_CSV}" | while IFS=',' read -r org repo gl_ns gl_proj repo_exists exists_status bc_gh branches_status def_branch default_branch_status cc_gh commits_status sha gl_bc bc_match gl_cc cc_match notes; do
    github_repo_fmt="${org}/${repo}"
    gitlab_proj_fmt="${gl_ns}/${gl_proj}"
    notes_esc="${notes//|/\\|}"
    echo "| ${github_repo_fmt} | ${gitlab_proj_fmt} | ${exists_status} | ${bc_gh} | ${gl_bc} | ${bc_match} | ${def_branch} | ${cc_gh} | ${gl_cc} | ${cc_match} | ${notes_esc} |"
  done
} > "${SUMMARY_MD}"

echo "[INFO] Markdown summary written: ${SUMMARY_MD}"

# -------------------------
# Final summary table
# -------------------------
echo
echo "===================== FINAL SUMMARY ====================="
printf "%-35s %-28s %-8s %-10s %-18s %-9s %-12s %-12s\n" \
  "GitHub Repo" "GitLab Project" "Exists" "Branches" "Default Branch" "Commits" "Branch-Match" "Commit-Match"

tail -n +2 "${SUMMARY_CSV}" | while IFS=',' read -r org repo gl_ns gl_proj repo_exists exists_status bc_gh branches_status def_branch default_branch_status cc_gh commits_status sha gl_bc bc_match gl_cc cc_match notes; do
  github_repo_fmt="${org}/${repo}"
  gitlab_proj_fmt="${gl_ns}/${gl_proj}"
  printf "%-35s %-28s %-8s %-10s %-18s %-9s %-12s %-12s\n" \
    "${github_repo_fmt}" "${gitlab_proj_fmt}" "${exists_status}" "${bc_gh}" "${def_branch}" "${commits_status}" "${bc_match}" "${cc_match}"
done

echo "========================================================="