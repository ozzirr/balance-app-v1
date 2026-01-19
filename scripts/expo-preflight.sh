#!/usr/bin/env bash
set -eu

PORT=8081

printf '=== Expo Preflight ===\n'

printf '\nDetected IPv4 addresses (non-loopback):\n'
ifconfig | awk '/^[a-z]/ { iface=$1 } /inet / && $2 != "127.0.0.1" { printf("  %s -> %s\n", iface, $2) }'

if command -v scutil >/dev/null 2>&1; then
  local_host=$(scutil --get LocalHostName 2>/dev/null || true)
  if [ -n "$local_host" ]; then
    printf '\nmacOS local host name: %s\n' "$local_host"
  fi
fi

printf '\nChecking port %s...\n' "$PORT"
port_info=$(lsof -nP -iTCP:"$PORT" -sTCP:LISTEN 2>/dev/null || true)
if [ -n "$port_info" ]; then
  printf 'Port %s is listening:\n%s\n' "$PORT" "$port_info"
else
  printf 'Port %s is not currently listening (Metro not running).\n' "$PORT"
fi

mapfile -t port_pids < <(lsof -t -nP -iTCP:"$PORT" -sTCP:LISTEN 2>/dev/null || true)
if [ ${#port_pids[@]} -gt 0 ]; then
  printf '\nFound process(es) occupying port %s: %s\n' "$PORT" "${port_pids[*]}"
  read -rp "Kill these PIDs and free port $PORT? [y/N] " resp
  if [[ "$resp" =~ ^[Yy]$ ]]; then
    for pid in "${port_pids[@]}"; do
      if kill "$pid" >/dev/null 2>&1; then
        printf 'Killed %s\n' "$pid"
      else
        printf 'Unable to kill %s (try sudo kill if needed).\n' "$pid"
      fi
    done
  else
    printf 'Left process(es) running. You can kill them manually with `kill <PID>`.\n'
  fi
else
  printf '\nNo Metro listeners detected on port %s.\n' "$PORT"
fi

printf '\nRecommended next step: `npm run start:lan` (switch to `start:tunnel` if LAN still fails).\n'
