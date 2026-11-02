#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
runtime_root="${SITES_RUNTIME_ROOT:-${project_root}/.sites-runtime}"

mkdir -p \
  "${runtime_root}/home" \
  "${runtime_root}/npm-cache" \
  "${runtime_root}/xdg-config" \
  "${runtime_root}/tmp" \
  "${runtime_root}/wrangler/logs"

export SITES_ENV_READY=1
export SITES_PROJECT_ROOT="${project_root}"
export HOME="${runtime_root}/home"
export XDG_CONFIG_HOME="${runtime_root}/xdg-config"
export TMPDIR="${runtime_root}/tmp"
export WRANGLER_WRITE_LOGS=false
export WRANGLER_LOG_PATH="${runtime_root}/wrangler/logs"
export WRANGLER_REGISTRY_PATH="${runtime_root}/wrangler/dev-registry"
export MINIFLARE_REGISTRY_PATH="${runtime_root}/wrangler/registry"

# The runtime may provide a global npm cache. Keep the image's read-only Sites
# seed separate and make this project's writable cache authoritative.
unset NPM_CONFIG_CACHE npm_config_cache || true
export npm_config_cache="${runtime_root}/npm-cache"
export npm_config_audit=false
export npm_config_fund=false
export npm_config_update_notifier=false

# The runtime already supplies the standard HTTP(S)_PROXY variables. Remove
# npm-specific aliases so npm 11 does not reinterpret or warn about them.
unset \
  npm_config_proxy \
  npm_config_http_proxy \
  npm_config_https_proxy \
  NPM_CONFIG_PROXY \
  NPM_CONFIG_HTTP_PROXY \
  NPM_CONFIG_HTTPS_PROXY \
  || true

if [[ "${1:-}" == "--" ]]; then
  shift
fi

if [[ "$#" -eq 0 ]]; then
  echo "usage: scripts/sites-env.sh -- command [args...]" >&2
  exit 64
fi

cd "${project_root}"
exec "$@"
