#!/usr/bin/env bash
# dev.sh - Start or stop Rakuseru's Vite development server through ./hako.
#
# Requires: ./hako and Docker.
# Service: web http://localhost:5173
# Command source: package.json script "dev" runs "vite --host 0.0.0.0".
set -Eeuo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly REPO_ROOT
readonly DEV_CONTAINER_NAME="rakuseru-dev"
readonly DEV_CONTAINER_LABEL="rakuseru.service=dev"

usage() {
	printf 'Usage: %s [up|start|down|stop|--help]\n' "${0##*/}" >&2
}

die() {
	printf 'Error: %s\n' "$*" >&2
	exit 1
}

require_command() {
	command -v "$1" >/dev/null 2>&1 || die "required command not found: $1"
}

require_docker_access() {
	require_command docker
	docker info >/dev/null 2>&1 || die "docker daemon is not reachable; cannot manage dev container"
}

start_dev() {
	cd "${REPO_ROOT}"

	[[ -x ./hako ]] || die "required executable not found: ./hako"
	[[ -d node_modules ]] || printf 'Warning: node_modules not found; run ./hako npm install before starting dev if dependencies are missing.\n' >&2

	HAKO_CONTAINER_NAME="${DEV_CONTAINER_NAME}" HAKO_CONTAINER_LABEL="${DEV_CONTAINER_LABEL}" exec ./hako npm run dev
}

stop_dev() {
	local container_ids
	local id

	require_docker_access

	container_ids=()
	if id=$(docker container inspect --format '{{.Id}}' "${DEV_CONTAINER_NAME}" 2>/dev/null); then
		container_ids+=("${id}")
	fi

	while IFS= read -r id; do
		[[ -n "${id}" ]] || continue
		[[ " ${container_ids[*]} " == *" ${id} "* ]] || container_ids+=("${id}")
	done < <(docker ps -aq --no-trunc --filter "label=${DEV_CONTAINER_LABEL}")

	if [[ ${#container_ids[@]} -eq 0 ]]; then
		printf '[dev.sh] no running or stopped dev container found: %s\n' "${DEV_CONTAINER_NAME}" >&2
		return 0
	fi

	printf '[dev.sh] stopping dev containers: %s\n' "${container_ids[*]}" >&2
	docker rm --force "${container_ids[@]}" >/dev/null
}

main() {
	local command_name

	command_name=${1:-up}

	case "${command_name}" in
	up | start)
		start_dev
		;;
	down | stop)
		stop_dev
		;;
	--help | -h)
		usage
		;;
	*)
		usage
		die "unknown command: ${command_name}"
		;;
	esac
}

main "$@"
