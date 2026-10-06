#!/usr/bin/env bash
#
# check-deploy.sh — deploy the site and confirm it's actually live, without
# hand-writing gh incantations each time. Modeled on check-deploy.sh in the
# personal site repo.
#
# Watches the "Update Data and Deploy" workflow (.github/workflows/update-data.yml),
# which fetches the reviews, builds, and deploys in a single run. When the run
# passes, it checks that the live site responds and reports how many reviews it
# serves, plus any reviews the run skipped (e.g. an address that couldn't be
# geocoded). A passing run alone isn't enough: the site has gone down before
# while serving a 404.
#
# Usage:
#   scripts/check-deploy.sh            # watch the run for the current commit
#   scripts/check-deploy.sh --push     # push the current branch first, then watch
#   scripts/check-deploy.sh --refresh  # rebuild from the sheet now (no commit needed), then watch
#
# Exit codes: 0 = deployed and live, 1 = run failed or site not serving,
#             2 = setup/usage error (including a disabled workflow).
#
# Requires: gh (authenticated), git, and curl.

set -euo pipefail

WORKFLOW="update-data.yml"
POLL_TIMEOUT=90     # seconds to wait for a run to appear after a push or refresh
POLL_INTERVAL=5

die() { echo "error: $*" >&2; exit 2; }

command -v gh   >/dev/null 2>&1 || die "gh (GitHub CLI) not found"
command -v git  >/dev/null 2>&1 || die "git not found"
command -v curl >/dev/null 2>&1 || die "curl not found"
gh auth status >/dev/null 2>&1 || die "gh is not authenticated — run: gh auth login"

cd "$(git rev-parse --show-toplevel)" || die "not in a git repository"
BRANCH=$(git rev-parse --abbrev-ref HEAD)
REPO=$(gh repo view --json nameWithOwner --jq .nameWithOwner)
SITE_URL=$(sed -n 's/.*"homepage": *"\([^"]*\)".*/\1/p' package.json)
[[ -n "$SITE_URL" ]] || die "no homepage in package.json"

# GitHub disables scheduled workflows in public repos after 60 days without a
# commit, and a disabled workflow doesn't run on push either, so check first.
STATE=$(gh api "repos/$REPO/actions/workflows/$WORKFLOW" --jq .state)
if [[ "$STATE" != "active" ]]; then
  die "the $WORKFLOW workflow is $STATE, so nothing will deploy.
       Re-enable it, then retry:
         gh workflow enable $WORKFLOW"
fi

# Find the newest run matching a jq filter, polling until it appears.
wait_for_run() {
  local filter=$1 run_id="" elapsed=0
  while (( elapsed < POLL_TIMEOUT )); do
    run_id=$(gh run list --workflow="$WORKFLOW" --limit 20 \
               --json databaseId,headSha,createdAt,event \
               --jq "map(select($filter)) | .[0].databaseId // empty" 2>/dev/null || true)
    [[ -n "$run_id" ]] && { echo "$run_id"; return; }
    sleep "$POLL_INTERVAL"
    (( elapsed += POLL_INTERVAL ))
  done
}

case "${1:-}" in
  --push)
    echo "==> checking $BRANCH against origin..."
    git fetch --quiet origin "$BRANCH" || die "could not fetch origin/$BRANCH"
    BEHIND=$(git rev-list --count HEAD..FETCH_HEAD)
    if (( BEHIND > 0 )); then
      die "$BRANCH is $BEHIND commit(s) behind origin/$BRANCH.
       Rebase, then retry:
         git pull --rebase origin $BRANCH"
    fi

    # A dirty tree means the files you just tested are not the files that
    # deploy. Worth saying out loud; not worth blocking on.
    if [[ -n "$(git status --porcelain)" ]]; then
      echo "warning: working tree has uncommitted changes." >&2
      echo "         Pushing HEAD ($(git rev-parse --short HEAD)); those changes stay local." >&2
    fi

    echo "==> pushing $BRANCH to origin..."
    git push origin "$BRANCH"
    ;;
  --refresh)
    # Back-date the start time a little so clock skew can't hide the new run
    START=$(( $(date +%s) - 30 ))
    echo "==> starting a rebuild from the sheet..."
    gh workflow run "$WORKFLOW" --ref main >/dev/null
    ;;
  "") ;;
  *) die "unknown argument: ${1} (use --push, --refresh, or no arguments)";;
esac

if [[ "${1:-}" == "--refresh" ]]; then
  echo "==> waiting for the run to start (up to ${POLL_TIMEOUT}s)..."
  RUN_ID=$(wait_for_run ".event == \"workflow_dispatch\" and (.createdAt | fromdateiso8601) >= $START")
  [[ -n "$RUN_ID" ]] || die "no run appeared after ${POLL_TIMEOUT}s — check the Actions tab"
else
  SHA=$(git rev-parse HEAD)
  echo "==> commit $(git rev-parse --short HEAD) on $BRANCH"
  echo "==> waiting for a '$WORKFLOW' run to start (up to ${POLL_TIMEOUT}s)..."
  RUN_ID=$(wait_for_run ".headSha == \"$SHA\"")
  if [[ -z "$RUN_ID" ]]; then
    echo "==> no '$WORKFLOW' run for this commit after ${POLL_TIMEOUT}s."
    echo "    The workflow only deploys from main; push there (or use --refresh)."
    exit 1
  fi
fi

echo "==> watching run $RUN_ID ..."
echo "    https://github.com/$REPO/actions/runs/$RUN_ID"
if ! gh run watch "$RUN_ID" --interval "$POLL_INTERVAL" --exit-status >/dev/null 2>&1; then
  echo
  echo "✗ Deploy FAILED — failing step output below (the live site is unchanged):"
  echo "----------------------------------------------------------------"
  gh run view "$RUN_ID" --log-failed 2>/dev/null | tail -30 || true
  echo "----------------------------------------------------------------"
  echo "  full logs: gh run view $RUN_ID --log-failed"
  exit 1
fi

# Reviews fetch_data.py couldn't publish, reported as warning annotations
JOB_ID=$(gh run view "$RUN_ID" --json jobs --jq '.jobs[0].databaseId')
SKIPPED=$(gh api "repos/$REPO/check-runs/$JOB_ID/annotations" \
            --jq '.[] | select(.title == "Skipped a review") | "    - \(.message)"' 2>/dev/null || true)

# Check the live site, bypassing the CDN cache (it holds pages for ~10 minutes)
BUST="?check=$(date +%s)"
STATUS=$(curl -s -o /dev/null -w '%{http_code}' -m 20 "$SITE_URL/$BUST" || echo "000")
REVIEWS=$(curl -fsS -m 20 "$SITE_URL/data/places.json$BUST" 2>/dev/null | grep -c '"id":' || true)

echo
if [[ "$STATUS" != "200" ]]; then
  echo "✗ Deploy run passed, but $SITE_URL/ returned HTTP $STATUS"
  exit 1
fi
if [[ "${REVIEWS:-0}" -eq 0 ]]; then
  echo "✗ Deploy run passed, but the live site has no reviews (data/places.json is empty or missing)"
  exit 1
fi

echo "✓ Deployed: $SITE_URL/ is serving $REVIEWS reviews"
if [[ -n "$SKIPPED" ]]; then
  echo "  Skipped (not on the site):"
  echo "$SKIPPED"
fi
