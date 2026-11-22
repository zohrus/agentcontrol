#!/usr/bin/env bash
# Signs, notarizes and packages AgentControl.app into dist/AgentControl-<version>-<arch>.dmg.
# Run on macOS after make-app.sh.
#
# Usage: scripts/mac/sign-and-notarize.sh <arm64|x64> [app-dir]    (default: dist/app-<arch>)
#
# Secrets, all from environment variables (see docs/releasing.md):
#   APPLE_CERT_P12_BASE64   Developer ID Application certificate + key, as a base64 .p12
#   APPLE_CERT_PASSWORD     password of that .p12
#   APPLE_SIGNING_IDENTITY  e.g. "Developer ID Application: Your Name (TEAMID)"
# Notarization, either with an Apple ID:
#   APPLE_ID, APPLE_TEAM_ID, APPLE_APP_PASSWORD   (app-specific password)
# or with an App Store Connect API key:
#   APPLE_API_KEY_BASE64 (the .p8 file, base64), APPLE_API_KEY_ID, APPLE_API_ISSUER
#
# Without the certificate variables the app is only ad-hoc signed and not notarized: the .dmg
# works on the machine that built it and, after right-click > Open, on others. It says so below.
set -euo pipefail

arch="${1:-}"
case "$arch" in arm64 | x64) ;; *) echo "usage: $0 <arm64|x64> [app-dir]" >&2; exit 2 ;; esac

root="$(cd "$(dirname "$0")/../.." && pwd)"
app_dir="${2:-$root/dist/app-$arch}"
app="$app_dir/AgentControl.app"
entitlements="$root/packages/mac/Resources/AgentControl.entitlements"
version="$(sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' "$root/package.json" | head -1)"
dmg="$root/dist/AgentControl-$version-$arch.dmg"
work="$(mktemp -d)"
keychain="$work/signing.keychain-db"
[ -d "$app" ] || { echo "missing $app (run make-app.sh first)" >&2; exit 1; }

cleanup() {
  security delete-keychain "$keychain" 2> /dev/null || true
  rm -rf "$work"
}
trap cleanup EXIT

have_certificate() { [ -n "${APPLE_CERT_P12_BASE64:-}" ] && [ -n "${APPLE_SIGNING_IDENTITY:-}" ]; }

have_notary_login() {
  { [ -n "${APPLE_ID:-}" ] && [ -n "${APPLE_TEAM_ID:-}" ] && [ -n "${APPLE_APP_PASSWORD:-}" ]; } \
    || { [ -n "${APPLE_API_KEY_BASE64:-}" ] && [ -n "${APPLE_API_KEY_ID:-}" ] && [ -n "${APPLE_API_ISSUER:-}" ]; }
}

import_certificate() {
  local password="${APPLE_CERT_PASSWORD:-}" keychain_password
  keychain_password="$(uuidgen)"
  echo "$APPLE_CERT_P12_BASE64" | base64 --decode > "$work/cert.p12"
  security create-keychain -p "$keychain_password" "$keychain"
  security set-keychain-settings -lut 3600 "$keychain"
  security unlock-keychain -p "$keychain_password" "$keychain"
  security import "$work/cert.p12" -k "$keychain" -P "$password" -T /usr/bin/codesign
  security set-key-partition-list -S apple-tool:,apple: -s -k "$keychain_password" "$keychain" > /dev/null
  # Put it first in the search list so codesign finds the identity.
  security list-keychains -d user -s "$keychain" $(security list-keychains -d user | tr -d '"')
}

notarize() { # notarize <file>
  local args=(--wait)
  if [ -n "${APPLE_API_KEY_BASE64:-}" ]; then
    echo "$APPLE_API_KEY_BASE64" | base64 --decode > "$work/key.p8"
    args+=(--key "$work/key.p8" --key-id "$APPLE_API_KEY_ID" --issuer "$APPLE_API_ISSUER")
  else
    args+=(--apple-id "$APPLE_ID" --team-id "$APPLE_TEAM_ID" --password "$APPLE_APP_PASSWORD")
  fi
  xcrun notarytool submit "$1" "${args[@]}"
}

if have_certificate; then
  identity="$APPLE_SIGNING_IDENTITY"
  sign_options=(--force --timestamp --options runtime --entitlements "$entitlements")
  import_certificate
else
  echo "NO SIGNING CERTIFICATE: building an ad-hoc signed, NOT notarized dmg (local testing only)."
  identity="-"
  sign_options=(--force --entitlements "$entitlements")
fi

# Inner binaries first, then the bundle that contains them.
for binary in "$app/Contents/Resources/agentcontrol" "$app/Contents/Resources/agentcontrol-relay" \
  "$app/Contents/MacOS/AgentControlMenu"; do
  codesign "${sign_options[@]}" --sign "$identity" "$binary"
done
codesign "${sign_options[@]}" --sign "$identity" "$app"
codesign --verify --strict --verbose=2 "$app"

if have_certificate && have_notary_login; then
  ditto -c -k --keepParent "$app" "$work/AgentControl.zip"
  notarize "$work/AgentControl.zip"
  xcrun stapler staple "$app"
elif have_certificate; then
  echo "SIGNED BUT NOT NOTARIZED: no notarization login in the environment; Gatekeeper will warn."
fi

# Disk image: the app next to an Applications shortcut. hdiutil is part of macOS.
stage="$work/dmg"
mkdir -p "$stage" "$root/dist"
cp -R "$app" "$stage/"
ln -s /Applications "$stage/Applications"
rm -f "$dmg"
hdiutil create -volname "AgentControl" -srcfolder "$stage" -ov -format UDZO "$dmg"

if have_certificate; then
  codesign --force --timestamp --sign "$identity" "$dmg"
  if have_notary_login; then
    notarize "$dmg"
    xcrun stapler staple "$dmg"
  fi
fi
echo "built $dmg"
