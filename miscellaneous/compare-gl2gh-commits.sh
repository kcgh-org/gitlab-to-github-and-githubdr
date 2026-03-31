#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${GITLAB_REPO_URL:-}" ]] || [[ -z "${GITHUB_REPO_URL:-}" ]]; then
  echo "Set below env before running the script"
  echo " -----------------------------------------------------------------------------"
  echo " export GITLAB_REPO_URL=http(s)://<gitlab-server>/<group>/<repo>.git"
  echo " export GITHUB_REPO_URL=https://<github-dr-host>/<org>/<repo>.git"
  echo " -----------------------------------------------------------------------------"
  exit 1
fi

if [[ -z "${GITLAB_API_PRIVATE_TOKEN:-}" ]]; then
  echo "ERROR: GITLAB_API_PRIVATE_TOKEN is not set"
  exit 1
fi

# ===== CONFIG =====
REPO_NAME="$(basename -s .git "$GITLAB_REPO_URL")"
WORKDIR="$(pwd)/commit-compare-${REPO_NAME}"
RUN_TS="$(date +"%Y%m%d_%H%M%S")"
# ==================

echo "Working directory: $WORKDIR"
mkdir -p "$WORKDIR"
cd "$WORKDIR"

echo "Cloning GitLab repo..."
if [[ "$GITLAB_REPO_URL" == https://* ]]; then
  GIT_SSL_NO_VERIFY=true \
  git clone --mirror \
    "https://oauth2:${GITLAB_API_PRIVATE_TOKEN}@${GITLAB_REPO_URL#https://}" \
    "gitlab_${RUN_TS}.git"
else
  git clone --mirror \
    "http://oauth2:${GITLAB_API_PRIVATE_TOKEN}@${GITLAB_REPO_URL#http://}" \
    "gitlab_${RUN_TS}.git"
fi

echo "Cloning GitHub DR repo..."
git clone --mirror "$GITHUB_REPO_URL" "github_${RUN_TS}.git"

echo "Extracting commit lists..."

git --git-dir="gitlab_${RUN_TS}.git" rev-list --all | sort > "gitlab_commits_${RUN_TS}.txt"
git --git-dir="github_${RUN_TS}.git" rev-list --all | sort > "github_commits_${RUN_TS}.txt"

echo "Counting commits:"
echo "GitLab  : $(wc -l < gitlab_commits_${RUN_TS}.txt)"
echo "GitHub  : $(wc -l < github_commits_${RUN_TS}.txt)"
echo

echo "Finding extra commits..."

comm -23 "github_commits_${RUN_TS}.txt" "gitlab_commits_${RUN_TS}.txt" > "extra_in_github_${RUN_TS}.txt"
comm -13 "github_commits_${RUN_TS}.txt" "gitlab_commits_${RUN_TS}.txt" > "extra_in_gitlab_${RUN_TS}.txt"

echo "Extra commits in GitHub DR: $(wc -l < extra_in_github_${RUN_TS}.txt)"
echo "Extra commits in GitLab   : $(wc -l < extra_in_gitlab_${RUN_TS}.txt)"
echo

print_commit_details () {
  local repo_dir=$1
  local file=$2
  local label=$3

  if [[ ! -s "$file" ]]; then
    echo "No extra commits in $label"
    return
  fi

  echo "========================================"
  echo "Extra commits in $label"
  echo "========================================"

  while read -r sha; do
    git --git-dir="$repo_dir" show \
      --no-patch \
      --format="commit: %H%nAuthor: %an <%ae>%nDate  : %ad%nSubject: %s%n" \
      "$sha"
    echo "----------------------------------------"
  done < "$file"
}

print_commit_details "github_${RUN_TS}.git" "extra_in_github_${RUN_TS}.txt" "GitHub DR"
print_commit_details "gitlab_${RUN_TS}.git" "extra_in_gitlab_${RUN_TS}.txt" "GitLab"

echo
echo "Done."
echo "Artifacts:"
echo " - ${WORKDIR}/gitlab_commits_${RUN_TS}.txt"
echo " - ${WORKDIR}/github_commits_${RUN_TS}.txt"
echo " - ${WORKDIR}/extra_in_github_${RUN_TS}.txt"
echo " - ${WORKDIR}/extra_in_gitlab_${RUN_TS}.txt"
