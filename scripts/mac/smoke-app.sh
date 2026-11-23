#!/usr/bin/env bash
# Runs the compiled app and relay of an assembled AgentControl.app for real, on a temp data folder:
# the server prints its "listening" line, /api/health answers with the token from <dataDir>/api-token
# (and refuses without it), /api/agents is answered by the compiled relay through the app, then both
# are stopped. Does not need a display, so it works on a CI runner.
#
# Usage: scripts/mac/smoke-app.sh <AgentControl.app>
# Overrides for testing off macOS: APP_BIN and RELAY_BIN name the two executables directly.
set -euo pipefail

app="${1:-}"
app_bin="${APP_BIN:-$app/Contents/Resources/agentcontrol}"
relay_bin="${RELAY_BIN:-$app/Contents/Resources/agentcontrol-relay}"
[ -x "$app_bin" ] || { echo "smoke FAILED: no executable at $app_bin" >&2; exit 1; }
[ -x "$relay_bin" ] || { echo "smoke FAILED: no executable at $relay_bin" >&2; exit 1; }

data="$(mktemp -d)"
log="$data/app.log"
server=""

cleanup() {
  [ -z "$server" ] || kill "$server" 2> /dev/null || true
  "$relay_bin" stop --data-dir "$data/relay" > /dev/null 2>&1 || true
  rm -rf "$data"
}
trap cleanup EXIT

fail() {
  echo "smoke FAILED: $1" >&2
  echo "--- app log ---" >&2
  cat "$log" >&2 || true
  exit 1
}

# Port 0: the system picks a free one, and the server says which in its listening line.
AGENTCONTROL_HOME="$data" AGENTCONTROL_PORT=0 AGENTCONTROL_RELAY_CMD="[\"$relay_bin\"]" \
  "$app_bin" > "$log" 2>&1 &
server=$!

url=""
for _ in $(seq 1 200); do
  url="$(sed -n 's/^AgentControl listening on //p' "$log" | head -1)"
  [ -z "$url" ] || break
  kill -0 "$server" 2> /dev/null || fail "the server exited before it was listening"
  sleep 0.1
done
[ -n "$url" ] || fail "no \"listening\" line after 20 seconds"
echo "server listening on $url"

token="$(cat "$data/api-token")"
[ -n "$token" ] || fail "api-token is empty"

health="$(curl -fsS -H "Authorization: Bearer $token" "$url/api/health")" || fail "/api/health failed"
echo "$health" | grep -q '"ok":true' || fail "/api/health answered $health"

status="$(curl -s -o /dev/null -w '%{http_code}' "$url/api/health")"
[ "$status" = 401 ] || fail "/api/health without the token answered $status, expected 401"

# This call goes app -> compiled relay (relay/hello), so it proves the two binaries talk.
agents="$(curl -fsS -H "Authorization: Bearer $token" "$url/api/agents")" || fail "/api/agents failed"
echo "$agents" | grep -q '"agents"' || fail "/api/agents answered $agents"
echo "relay answered through the app: $agents"

kill "$server"
for _ in $(seq 1 100); do kill -0 "$server" 2> /dev/null || break; sleep 0.1; done
kill -0 "$server" 2> /dev/null && fail "the server did not stop on SIGTERM"
server=""
echo "smoke passed"
