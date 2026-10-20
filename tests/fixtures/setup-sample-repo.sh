#!/usr/bin/env bash
set -euo pipefail
BASE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$BASE/sample-repo"
rm -rf "$ROOT"
mkdir -p "$ROOT"
cd "$ROOT"
git init -q
git config user.email "test@example.com"
git config user.name "Test Author"
echo "hello" > README.md
git add README.md
git commit -q -m "feat: initial commit"
GIT_AUTHOR_DATE="2026-10-20T10:00:00" GIT_COMMITTER_DATE="2026-10-20T10:00:00" \
  git commit --allow-empty -q -m "fix: patch release"
