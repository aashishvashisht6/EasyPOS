#!/usr/bin/env bash
# Runs posapp's own locally-installed ESLint (its flat-config eslint.config.js,
# with the exact eslint-plugin-react-hooks/react-refresh versions pinned in
# posapp/package.json) instead of the old pre-commit mirrors-eslint hook's own
# isolated, version-pinned install.
#
# mirrors-eslint was pinned to ESLint 8.44.0, but posapp uses ESLint 9's flat
# config plus eslint-plugin-react-hooks@^7 — a plugin built for ESLint 9's
# flat-config plugin object shape. ESLint 8's flat-config support can't
# resolve rules from it, failing with "Definition for rule
# 'react-hooks/exhaustive-deps' was not found" on every file, regardless of
# whether the code actually violates anything. Running the project's own
# installed ESLint (same version CLAUDE.md's documented `npx eslint` command
# uses) avoids the mismatch entirely.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT/posapp"

if [ ! -d node_modules ]; then
	echo "posapp/node_modules is missing. Run: cd posapp && yarn install" >&2
	exit 1
fi

# A pre-commit "script"-language hook's subprocess doesn't necessarily carry
# the PATH additions an interactive shell picks up from .zshrc/.bashrc — an
# nvm-managed `node` is the common case (nvm's PATH entry is normally added
# by shell rc sourcing, not inherited by every subprocess). Sourcing nvm.sh
# alone doesn't fix this either: it only defines the `nvm` function, and its
# `default` alias can point at an LTS version that isn't actually installed
# (nvm's alias resolution is its own rabbit hole) — so instead, just look for
# whatever node version is actually present on disk and use that directly.
if ! command -v node >/dev/null 2>&1; then
	NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
	if [ -d "$NVM_DIR/versions/node" ]; then
		newest="$(ls -1 "$NVM_DIR/versions/node" 2>/dev/null | sort -V | tail -1)"
		if [ -n "$newest" ] && [ -x "$NVM_DIR/versions/node/$newest/bin/node" ]; then
			export PATH="$NVM_DIR/versions/node/$newest/bin:$PATH"
		fi
	fi
fi

if ! command -v node >/dev/null 2>&1; then
	echo "node is not on PATH (and none found under ~/.nvm/versions/node either). Install Node.js or ensure it's reachable." >&2
	exit 1
fi

# pre-commit passes repo-root-relative paths (e.g. posapp/src/App.jsx); this
# hook's `files:` regex only ever matches paths under posapp/, so strip that
# prefix to make them relative to this script's cwd.
files=()
for f in "$@"; do
	files+=("${f#posapp/}")
done

# Invoke the local binary directly rather than through npx — npx adds its own
# resolution/network-check overhead we don't need, since node_modules is
# already confirmed present above.
node_modules/.bin/eslint --quiet "${files[@]}"
