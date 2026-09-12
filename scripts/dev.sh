#!/usr/bin/env sh
# dead-drop dev server lifecycle — THE way to start/stop/status local servers.
# Agents and humans: use this, never ad-hoc starts, never port/config changes.
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOGDIR="${TMPDIR:-/tmp}"

CORE_API_PORT=9090
CORE_UI_PORT=3010
ADMIN_API_PORT=9091
ADMIN_UI_PORT=3011

pid_on() {
  # ss is authoritative; lsof is blind to next-server's renamed processes
  _p="$(ss -ltnp "sport = :$1" 2>/dev/null | grep -oE 'pid=[0-9]+' | head -1 | cut -d= -f2)"
  [ -n "$_p" ] && { echo "$_p"; return 0; }
  lsof -ti ":$1" 2>/dev/null | head -1
}

api_healthy() { curl -sf -m 3 "http://localhost:$1/api/v1/health" >/dev/null 2>&1; }
ui_healthy() { [ "$(curl -s -m 3 -o /dev/null -w '%{http_code}' "http://localhost:$1" 2>/dev/null)" = "200" ]; }

wait_for() { # $1=desc $2=check_fn $3=port $4=timeout_s
  _i=0
  while [ "$_i" -lt "$4" ]; do
    if "$2" "$3"; then return 0; fi
    sleep 1
    _i=$((_i + 1))
  done
  echo "  TIMEOUT waiting for $1 (port $3) after ${4}s — see log" >&2
  return 1
}

ensure_service() { # $1=desc $2=port $3=health_fn $4=start_cmd $5=log $6=timeout
  _desc="$1"; _port="$2"; _hf="$3"; _cmd="$4"; _log="$5"; _to="$6"
  if "$_hf" "$_port"; then
    echo "  $_desc: already running and healthy on :$_port (pid $(pid_on "$_port")) — reusing"
    return 0
  fi
  _pid="$(pid_on "$_port")"
  if [ -n "$_pid" ]; then
    echo "  $_desc: port :$_port occupied by pid $_pid but NOT healthy — killing it"
    kill -9 "$_pid" 2>/dev/null
    sleep 1
  fi
  echo "  $_desc: starting on :$_port (log: $_log)"
  ( cd "$ROOT" && nohup sh -c "$_cmd" >"$_log" 2>&1 & )
  wait_for "$_desc" "$_hf" "$_port" "$_to" || return 1
  echo "  $_desc: healthy on :$_port (pid $(pid_on "$_port"))"
}

status_one() { # $1=desc $2=port $3=health_fn
  _pid="$(pid_on "$2")"
  if [ -z "$_pid" ]; then
    echo "  $1: stopped (:$2)"
  elif "$3" "$2"; then
    echo "  $1: RUNNING healthy :$2 (pid $_pid)"
  else
    echo "  $1: RUNNING but UNHEALTHY :$2 (pid $_pid) — fix: dev.sh down && dev.sh up"
  fi
}

core_api_start()  { ensure_service "core API"  "$CORE_API_PORT"  api_healthy "cd apps/core && pnpm dev:api" "$LOGDIR/dd-core-api.log" 30; }
core_ui_start()   { ensure_service "core UI"   "$CORE_UI_PORT"   ui_healthy  "cd apps/core && pnpm dev"     "$LOGDIR/dd-core-ui.log"  90; }
admin_api_start() { ensure_service "admin API" "$ADMIN_API_PORT" api_healthy "cd apps/admin && pnpm dev:api" "$LOGDIR/dd-admin-api.log" 30; }
admin_ui_start()  { ensure_service "admin UI"  "$ADMIN_UI_PORT"  ui_healthy  "cd apps/admin && pnpm dev"    "$LOGDIR/dd-admin-ui.log" 90; }

# NOTE: root `pnpm dev` = turbo dev = ALL apps at once. Never use it here;
# we scope each service to its own package.

case "${1:-}" in
  up)
    echo "core stack:"
    core_api_start || exit 1
    core_ui_start || exit 1
    if [ "${2:-}" = "admin" ]; then
      echo "admin stack:"
      admin_api_start || exit 1
      admin_ui_start || exit 1
    fi
    echo "done. status: ./scripts/dev.sh status"
    ;;
  down)
    for p in "$CORE_API_PORT" "$CORE_UI_PORT" "$ADMIN_API_PORT" "$ADMIN_UI_PORT"; do
      _pid="$(pid_on "$p")"
      if [ -n "$_pid" ]; then kill -9 "$_pid" 2>/dev/null; echo "  killed :$p (pid $_pid)"; fi
      # sweep process trees lsof/ss may miss (sh -c wrappers, parents)
      case "$p" in
        "$CORE_API_PORT")  pkill -9 -f "tsx src/dev/server.ts" 2>/dev/null ;;
        "$CORE_UI_PORT")   pkill -9 -f "next dev --port $CORE_UI_PORT" 2>/dev/null ;;
        "$ADMIN_API_PORT") pkill -9 -f "tsx src/dev/server.ts" 2>/dev/null ;;
        "$ADMIN_UI_PORT")  pkill -9 -f "next dev --port $ADMIN_UI_PORT" 2>/dev/null ;;
      esac
    done
    echo "down."
    ;;
  status)
    status_one "core API"  "$CORE_API_PORT"  api_healthy
    status_one "core UI"   "$CORE_UI_PORT"   ui_healthy
    status_one "admin API" "$ADMIN_API_PORT" api_healthy
    status_one "admin UI"  "$ADMIN_UI_PORT"  ui_healthy
    ;;
  *)
    echo "usage: dev.sh up [admin] | down | status"
    echo "  up        start core stack (reuse if healthy, replace if zombie)"
    echo "  up admin  core + admin stacks"
    echo "  down      stop everything (all four ports)"
    echo "  status    port/pid/health of all four services"
    exit 1
    ;;
esac
