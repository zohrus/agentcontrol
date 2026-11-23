#!/usr/bin/env bash
# Assembles AgentControl.app for one architecture. Run on macOS after:
#   bun run build                                   (the binaries in dist/)
#   swift build -c release [--arch x86_64]          (inside packages/mac; --arch only for x64)
#
# Usage: scripts/mac/make-app.sh <arm64|x64> [output-dir]
# Output: <output-dir>/AgentControl.app   (default output-dir: dist/app-<arch>)
#
# The bundle holds: the Swift menu bar binary (Contents/MacOS), the Bun app binary and this
# architecture's relay (Contents/Resources), and the Linux relays the app copies to remote
# workspaces (Contents/Resources/relays). Signing happens in sign-and-notarize.sh.
set -euo pipefail

arch="${1:-}"
case "$arch" in
  arm64) swift_arch="arm64" ;;
  x64) swift_arch="x86_64" ;;
  *) echo "usage: $0 <arm64|x64> [output-dir]" >&2; exit 2 ;;
esac

root="$(cd "$(dirname "$0")/../.." && pwd)"
out="${2:-$root/dist/app-$arch}"
mac="$root/packages/mac"
version="$(sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' "$root/package.json" | head -1)"
[ -n "$version" ] || { echo "no version in package.json" >&2; exit 1; }

bin_dir="$(cd "$mac" && swift build -c release --arch "$swift_arch" --show-bin-path)"
swift_binary="$bin_dir/AgentControlMenu"

need() { [ -f "$1" ] || { echo "missing $1 (run the earlier build steps first)" >&2; exit 1; }; }
need "$swift_binary"
need "$root/dist/agentcontrol-darwin-$arch"
need "$root/dist/agentcontrol-relay-darwin-$arch"
need "$root/dist/agentcontrol-relay-linux-x64"
need "$root/dist/agentcontrol-relay-linux-arm64"

app="$out/AgentControl.app"
rm -rf "$app"
mkdir -p "$app/Contents/MacOS" "$app/Contents/Resources/relays"

cp "$swift_binary" "$app/Contents/MacOS/AgentControlMenu"
cp "$root/dist/agentcontrol-darwin-$arch" "$app/Contents/Resources/agentcontrol"
cp "$root/dist/agentcontrol-relay-darwin-$arch" "$app/Contents/Resources/agentcontrol-relay"
cp "$root/dist/agentcontrol-relay-linux-x64" "$root/dist/agentcontrol-relay-linux-arm64" \
  "$app/Contents/Resources/relays/"
sed "s/@VERSION@/$version/g" "$mac/Resources/Info.plist" > "$app/Contents/Info.plist"
chmod +x "$app/Contents/MacOS/AgentControlMenu" "$app/Contents/Resources/agentcontrol" \
  "$app/Contents/Resources/agentcontrol-relay"

# Self-checks: the plist is valid, the Mach-O binaries are the right architecture.
plutil -lint "$app/Contents/Info.plist"
for macho in "$app/Contents/MacOS/AgentControlMenu" "$app/Contents/Resources/agentcontrol" \
  "$app/Contents/Resources/agentcontrol-relay"; do
  lipo -archs "$macho" | grep -qw "$swift_arch" || { echo "$macho is not $swift_arch" >&2; exit 1; }
done
echo "built $app (version $version, $arch)"
