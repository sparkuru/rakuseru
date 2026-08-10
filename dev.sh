#!/usr/bin/env bash
# dev.sh - Start and stop Rakuseru's Vite web service through ./hako.
#
# Requires: ./hako and Docker.
# Services:
#   web  http://${HAKO_BIND_HOST:-127.0.0.1}:${WEB_HOST_PORT:-5173}
set -Eeuo pipefail

SCRIPT_NAME="$(basename "$0")"
readonly SCRIPT_NAME
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly REPO_ROOT
readonly PROJECT_LABEL="hako.repo=${REPO_ROOT}"
readonly SCOPE_LABEL="hako.scope=dev.sh"

HAKO_BIND_HOST="${HAKO_BIND_HOST:-127.0.0.1}"
WEB_HOST_PORT="${WEB_HOST_PORT:-5173}"
WEB_CONTAINER_PORT="${WEB_CONTAINER_PORT:-5173}"

service_pids=()

usage() {
  printf 'Usage: %s [start|up|down|stop|--help]\n' "${SCRIPT_NAME}" >&2
}

die() {
  printf 'Error: %s\n' "$*" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || die "required command not found: $1"
}

down_services() {
  local mode=${1:-verbose}
  local -a container_ids=()

  if ! command -v docker >/dev/null 2>&1; then
    [[ "${mode}" == quiet ]] || printf '[dev.sh] docker is not available; no containers stopped\n' >&2
    return 0
  fi

  mapfile -t container_ids < <(
    docker ps -q \
      --filter "label=${PROJECT_LABEL}" \
      --filter "label=${SCOPE_LABEL}"
  )
  if [[ ${#container_ids[@]} -eq 0 ]]; then
    [[ "${mode}" == quiet ]] || printf '[dev.sh] no dev containers found\n' >&2
    return 0
  fi

  printf '[dev.sh] stopping %s container(s)\n' "${#container_ids[@]}" >&2
  docker stop "${container_ids[@]}" >/dev/null
}

cleanup() {
  local pid

  down_services quiet
  for pid in "${service_pids[@]}"; do
    kill "${pid}" 2>/dev/null || true
  done
}

run_service() {
  local name=$1
  shift

  printf '[dev.sh] starting %s: %s\n' "${name}" "$*" >&2
  env \
    HAKO_SCOPE=dev.sh \
    HAKO_SERVICE="${name}" \
    HAKO_BIND_HOST="${HAKO_BIND_HOST}" \
    WEB_HOST_PORT="${WEB_HOST_PORT}" \
    WEB_CONTAINER_PORT="${WEB_CONTAINER_PORT}" \
    "$@" &
  service_pids+=("$!")
}

start_services() {
  local status=0

  cd "${REPO_ROOT}"
  require_command docker
  [[ -x ./hako ]] || die 'required executable not found: ./hako'
  [[ -d node_modules ]] || printf 'Warning: node_modules not found; run ./hako npm install first.\n' >&2

  trap cleanup INT TERM EXIT
  down_services quiet

  printf '[dev.sh] web: http://%s:%s\n' "${HAKO_BIND_HOST}" "${WEB_HOST_PORT}" >&2
  run_service web ./hako npm run dev -- --host 0.0.0.0 --port "${WEB_CONTAINER_PORT}"

  wait -n "${service_pids[@]}" || status=$?
  trap - INT TERM EXIT
  cleanup
  return "${status}"
}

main() {
  local command_name=${1:-start}

  case "${command_name}" in
    start | up)
      start_services
      ;;
    down | stop)
      cd "${REPO_ROOT}"
      down_services
      ;;
    --help | -h)
      usage
      ;;
    *)
      usage
      return 2
      ;;
  esac
}

main "$@"
