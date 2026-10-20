#!/usr/bin/env bash
# Merge upstream Equicord into this fork, validate the result, and only then
# move main. Run by .github/workflows/syncupstream.yml (see FORK.md).
#
#   1. Candidate = sync/upstream (an earlier or hand/AI-fixed merge) + main + upstream,
#      falling back to a fresh main + upstream merge.
#   2. Merge conflict    -> open an "upstream-sync" issue for the local fixer, stop.
#   3. Validate the candidate (types, lint, desktop and web builds, plugin metadata).
#   4. Validation passed -> fast-forward main, close sync issues, ask for a release.
#      Validation failed -> push the candidate to sync/upstream, open an issue for the fixer.
#
# Needs: GH_TOKEN, GITHUB_REPOSITORY, git, gh, pnpm. Writes promoted/commit/release to GITHUB_OUTPUT.
set -euo pipefail

UPSTREAM_REPO="${UPSTREAM_REPO:-Equicord/Equicord}"
UPSTREAM_BRANCH="${UPSTREAM_BRANCH:-main}"
SYNC_BRANCH="sync/upstream"
LABEL="upstream-sync"
FIX_LABEL="needs-ai-fix"
REPO="$GITHUB_REPOSITORY"
RUN_URL="${GITHUB_SERVER_URL:-https://github.com}/$REPO/actions/runs/${GITHUB_RUN_ID:-0}"
OUTPUT="${GITHUB_OUTPUT:-/dev/null}"
MERGE_OPTS=(--no-edit -s ort -X diff-algorithm=histogram -X find-renames)

log() { echo "::notice::$*"; }

git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
git config rerere.enabled true

git remote get-url upstream >/dev/null 2>&1 || git remote add upstream "https://github.com/$UPSTREAM_REPO.git"
git fetch --no-tags upstream "$UPSTREAM_BRANCH"
git fetch --no-tags origin main
HAS_SYNC=0
git fetch --no-tags origin "$SYNC_BRANCH" 2>/dev/null && HAS_SYNC=1

UP=$(git rev-parse "upstream/$UPSTREAM_BRANCH")
MAIN=$(git rev-parse origin/main)
SHORT=${UP:0:7}

if git merge-base --is-ancestor "$UP" "$MAIN"; then
  log "main already contains upstream $SHORT"
  exit 0
fi

ensure_labels() {
  gh label create "$LABEL" -R "$REPO" --color 1D76DB --description "Automatic upstream sync" --force >/dev/null
  gh label create "$FIX_LABEL" -R "$REPO" --color D93F0B --description "Picked up by the local Claude fixer" --force >/dev/null
  gh label create ai-fixing -R "$REPO" --color FBCA04 --description "The local Claude fixer is working on it" --force >/dev/null
  gh label create needs-human -R "$REPO" --color B60205 --description "Automatic fixing gave up" --force >/dev/null
}

# open_issue KIND TITLE BODY: one open issue per kind+upstream commit; repeats become comments.
open_issue() {
  local kind=$1 title=$2 body=$3 existing
  ensure_labels
  existing=$(gh issue list -R "$REPO" --state open --label "$LABEL" --json number,title \
    -q ".[] | select(.title == \"$title\") | .number" | head -n1)
  body="$body

<!-- fork-sync kind=$kind upstream=$UP main=$MAIN run=$RUN_URL -->"
  if [ -n "$existing" ]; then
    gh issue comment "$existing" -R "$REPO" --body "Still failing in $RUN_URL"
  else
    gh issue create -R "$REPO" --title "$title" --label "$LABEL" --label "$FIX_LABEL" --body "$body"
  fi
}

# try_merge BASE REF...: merge each REF into BASE on the local "candidate" branch.
CONFLICTS=""
try_merge() {
  local base=$1; shift
  git checkout -q -B candidate "$base"
  for ref in "$@"; do
    if ! git merge "${MERGE_OPTS[@]}" -m "Merge $ref ($(git rev-parse --short "$ref")) into fork" "$ref"; then
      CONFLICTS=$(git diff --name-only --diff-filter=U)
      git merge --abort
      return 1
    fi
  done
}

OK=0
if [ "$HAS_SYNC" = 1 ] && try_merge "origin/$SYNC_BRANCH" origin/main "upstream/$UPSTREAM_BRANCH"; then
  OK=1
  log "Candidate built on top of existing $SYNC_BRANCH"
elif try_merge origin/main "upstream/$UPSTREAM_BRANCH"; then
  OK=1
  log "Candidate built fresh from main"
fi

if [ "$OK" = 0 ]; then
  open_issue conflict "Upstream sync: merge conflict ($SHORT)" "$(cat <<EOF
Merging upstream [\`$SHORT\`](https://github.com/$UPSTREAM_REPO/commit/$UP) into \`main\` hit conflicts in:

\`\`\`
$CONFLICTS
\`\`\`

\`main\` was not changed. The local fixer resolves this on \`$SYNC_BRANCH\` and re-runs the sync. To fix it by hand
instead, see "Fixing by hand" in FORK.md.

Sync run: $RUN_URL
EOF
)"
  exit 1
fi

CANDIDATE=$(git rev-parse candidate)
VALIDATION_LOG=$(mktemp)
# Chained with && because set -e is ignored inside a function called from `if`.
validate() {
  pnpm install --frozen-lockfile &&
  pnpm testTsc &&
  pnpm lint &&
  pnpm lint-styles &&
  pnpm buildStandalone &&
  pnpm buildWebStandalone &&
  pnpm generatePluginJson dist/plugins.json
}

log "Validating $CANDIDATE"
if ! validate 2>&1 | tee "$VALIDATION_LOG"; then
  git push -f origin "candidate:refs/heads/$SYNC_BRANCH"
  FAILED_LOG=$(grep -E 'error|ERROR|✘|ERR_' "$VALIDATION_LOG" | grep -v '^\s*$' | head -n 60 || true)
  [ -n "$FAILED_LOG" ] || FAILED_LOG=$(tail -n 60 "$VALIDATION_LOG")
  open_issue build "Upstream sync: validation failed ($SHORT)" "$(cat <<EOF
Upstream [\`$SHORT\`](https://github.com/$UPSTREAM_REPO/commit/$UP) merged cleanly into \`$SYNC_BRANCH\`
(\`${CANDIDATE:0:7}\`), but validation failed:

\`\`\`
$FAILED_LOG
\`\`\`

\`main\` was not changed. The local fixer fixes this on \`$SYNC_BRANCH\` and re-runs the sync. Full log: $RUN_URL
EOF
)"
  exit 1
fi

# Promote. Plain push: if main moved during validation this fails and the next run retries.
git push origin "candidate:main"
git push origin --delete "$SYNC_BRANCH" 2>/dev/null || true

for n in $(gh issue list -R "$REPO" --state open --label "$LABEL" --json number -q '.[].number'); do
  gh issue close "$n" -R "$REPO" --comment "Synced upstream \`$SHORT\` into \`main\` (\`${CANDIDATE:0:7}\`, validation passed: $RUN_URL). A release is being published."
done

{
  echo "promoted=true"
  echo "commit=$CANDIDATE"
  # A push made with a personal token triggers build.yml by itself; one made with GITHUB_TOKEN doesn't.
  [ "${PUSHED_WITH_PAT:-false}" = true ] && echo "release=false" || echo "release=true"
} >> "$OUTPUT"
log "main is now ${CANDIDATE:0:7} with upstream $SHORT"
