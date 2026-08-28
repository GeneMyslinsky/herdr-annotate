#!/usr/bin/env bash
# Put the pinned plannotator-tui release into bin/. Run by Herdr as a plugin build step
# (cwd = plugin root) and by hand for local testing.
#
#   plannotator-tui.version        the release to install (one line, e.g. 0.1.0)
#   bin/plannotator-tui            the binary
#   bin/plannotator-tui.version    what is installed; matching the pin means nothing to do
#
# Modes, in order:
#   1. already installed at the pinned version         -> exit 0
#   2. PLANNOTATOR_TUI_BIN=/path/to/binary is set      -> copy it (local testing, no download)
#   3. otherwise download the release asset for this platform and verify its sha256
set -euo pipefail

cd "$(dirname "$0")/.."
version="$(tr -d '[:space:]' < plannotator-tui.version)"
[ -n "$version" ] || { echo "plannotator-tui.version is empty" >&2; exit 1; }
mkdir -p bin
installed="$(cat bin/plannotator-tui.version 2>/dev/null || true)"

if [ -x bin/plannotator-tui ] && [ "$installed" = "$version" ] && [ -z "${PLANNOTATOR_TUI_BIN:-}" ]; then
  echo "plannotator-tui $version already installed"
  exit 0
fi

if [ -n "${PLANNOTATOR_TUI_BIN:-}" ]; then
  [ -x "$PLANNOTATOR_TUI_BIN" ] || { echo "PLANNOTATOR_TUI_BIN is not an executable: $PLANNOTATOR_TUI_BIN" >&2; exit 1; }
  cp "$PLANNOTATOR_TUI_BIN" bin/plannotator-tui.tmp
  chmod +x bin/plannotator-tui.tmp
  mv bin/plannotator-tui.tmp bin/plannotator-tui
  echo "$version" > bin/plannotator-tui.version
  echo "installed plannotator-tui from $PLANNOTATOR_TUI_BIN (local build, stamped $version)"
  exit 0
fi

case "$(uname -s)/$(uname -m)" in
  Darwin/arm64)            target=aarch64-apple-darwin ;;
  Darwin/x86_64)           target=x86_64-apple-darwin ;;
  Linux/x86_64)            target=x86_64-unknown-linux-gnu ;;
  Linux/aarch64|Linux/arm64) target=aarch64-unknown-linux-gnu ;;
  *) echo "no plannotator-tui build for $(uname -s)/$(uname -m)" >&2; exit 1 ;;
esac

asset="plannotator-tui-$target"
base="https://github.com/plannotator/plannotator-tui/releases/download/v$version"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

fetch() {
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL --retry 3 -o "$2" "$1"
  elif command -v wget >/dev/null 2>&1; then
    wget -q -O "$2" "$1"
  else
    echo "need curl or wget" >&2; exit 1
  fi
}

echo "downloading $base/$asset"
fetch "$base/$asset" "$tmp/$asset"       || { echo "download failed: $base/$asset" >&2; exit 1; }
fetch "$base/SHA256SUMS" "$tmp/SHA256SUMS" || { echo "download failed: $base/SHA256SUMS" >&2; exit 1; }

expected="$(grep " $asset\$" "$tmp/SHA256SUMS" | awk '{print $1}')"
[ -n "$expected" ] || { echo "$asset is not listed in $base/SHA256SUMS" >&2; exit 1; }
if command -v sha256sum >/dev/null 2>&1; then
  actual="$(sha256sum "$tmp/$asset" | awk '{print $1}')"
else
  actual="$(shasum -a 256 "$tmp/$asset" | awk '{print $1}')"
fi
[ "$actual" = "$expected" ] || { echo "sha256 mismatch for $asset: expected $expected, got $actual" >&2; exit 1; }

chmod +x "$tmp/$asset"
mv "$tmp/$asset" bin/plannotator-tui
echo "$version" > bin/plannotator-tui.version
echo "installed plannotator-tui $version ($target)"
