#!/usr/bin/env bash
# Runs the same Semgrep rules as .github/workflows/linter.yml, for local
# pre-commit use. Requires `pip install semgrep` (not installed automatically
# to keep pre-commit env creation fast/offline-friendly).
#
# Only newly-introduced findings (vs. SEMGREP_BASELINE_COMMIT, default "HEAD"
# — i.e. the last commit, the right comparison point for a pre-commit hook)
# are reported, mirroring `semgrep ci`'s diff-aware behavior on a PR — a
# plain `semgrep scan` would instead flag every pre-existing issue in every
# file touched, which would block commits on unrelated legacy debt.
set -euo pipefail

if ! command -v semgrep >/dev/null 2>&1; then
	echo "semgrep is not installed. Run: pip install semgrep" >&2
	exit 1
fi

RULES_DIR="${SEMGREP_RULES_CACHE:-$HOME/.cache/frappe-semgrep-rules}"

if [ -d "$RULES_DIR/.git" ]; then
	# Reset to the remote's default branch tip rather than `pull --ff-only`,
	# which fails ambiguously ("Cannot fast-forward to multiple branches")
	# against a shallow --depth 1 clone with no local branch to track.
	git -C "$RULES_DIR" fetch --depth 1 --quiet origin >/dev/null 2>&1 &&
		git -C "$RULES_DIR" reset --hard --quiet FETCH_HEAD >/dev/null 2>&1 || true
else
	# A directory that exists but isn't a valid clone (no .git) means a
	# previous clone attempt here was interrupted (network hiccup, killed
	# job, ...) — `git clone` refuses to reuse a non-empty target, so clear
	# it first rather than permanently blocking every future run. This
	# hook also has require_serial: true in .pre-commit-config.yaml so two
	# invocations never race each other's clone into this same path.
	if [ -e "$RULES_DIR" ]; then
		rm -rf "$RULES_DIR"
	fi
	git clone --depth 1 --quiet https://github.com/frappe/semgrep-rules.git "$RULES_DIR"
fi

BASELINE_ARGS=()
if semgrep scan --help 2>&1 | grep -q -- '--baseline-commit'; then
	BASELINE_ARGS=(--baseline-commit "${SEMGREP_BASELINE_COMMIT:-HEAD}")
else
	echo "warning: this semgrep version doesn't support --baseline-commit (diff-aware scan)." >&2
	echo "         Findings may include pre-existing issues in changed files, not just new ones." >&2
	echo "         Run 'pip install --upgrade semgrep' to enable diff-aware scanning." >&2
fi

# --baseline-commit aborts if there are unstaged changes in the working tree.
# pre-commit stashes unstaged changes before running hooks during a real
# `git commit`, so this is normally a non-issue there; it only bites a manual
# `pre-commit run --all-files` with a genuinely dirty working tree.
semgrep scan --quiet --error \
	"${BASELINE_ARGS[@]+"${BASELINE_ARGS[@]}"}" \
	--config "$RULES_DIR/rules" \
	--config r/python.lang.correctness \
	"$@"
