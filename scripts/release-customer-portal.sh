#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

find_runtime_kit() {
  local candidate
  for candidate in \
    "${MNSCLOUD_RUNTIME_KIT_DIR:-}" \
    "${ROOT_DIR}/../mnscloud-runtime-kit" \
    "/opt/mnscloud/runtime-kit" \
    "/opt/mnscloud/repos/mnscloud-runtime-kit"; do
    [[ -n "$candidate" && -r "${candidate}/lib/release.sh" ]] || continue
    printf '%s\n' "$candidate"
    return 0
  done
  return 1
}

cd "$ROOT_DIR"
RUNTIME_KIT_DIR="$(find_runtime_kit)" || {
  printf '[mnscloud-customer-portal] ERROR: mnscloud-runtime-kit lib/release.sh not found\n' >&2
  exit 1
}

# shellcheck source=/opt/mnscloud/runtime-kit/lib/release.sh
source "${RUNTIME_KIT_DIR}/lib/release.sh"

# Static web release artifact consumed by mnscloud-webapps (APP_SOURCE=release). It is built with
# the default same-origin API base (/api/v1) and a portable root base href; the hosting runtime
# rewrites <base href> to its own path.
export MNSCLOUD_RUNTIME_KIT_DIR="$RUNTIME_KIT_DIR"
package_web_artifact='"$MNSCLOUD_RUNTIME_KIT_DIR/scripts/package-static-artifact.sh" --source-dir dist/mnscloud-customer-portal/browser --name "mnscloud-customer-portal-web-v$(tr -d "[:space:]" < VERSION).tar.gz"'

mrtk_release_prepare \
  --product mnscloud-customer-portal \
  --repository manaoscloud/mnscloud-customer-portal \
  --minimum-version 0.1.0 \
  --sync-package-json \
  --validate 'npm run build' \
  --validate "grep -qF '<base href=\"/\">' dist/mnscloud-customer-portal/browser/index.html" \
  --validate "$package_web_artifact" \
  --asset-glob "releases/mnscloud-customer-portal-web-v*.tar.gz*" \
  "$@"
