#!/usr/bin/env bash

set -euo pipefail

SCRIPT_UNDER_TEST="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/sync-convex-from-web.sh"
TEMP_ROOT="$(mktemp -d)"
trap 'rm -rf "$TEMP_ROOT"' EXIT

MOBILE_REPO="$TEMP_ROOT/work/otopair"
WEB_REPO="$TEMP_ROOT/work/otopair-web"
HOME_DIR="$TEMP_ROOT/home"
BIN_DIR="$TEMP_ROOT/bin"

mkdir -p "$MOBILE_REPO/scripts" "$MOBILE_REPO/convex" "$MOBILE_REPO/lib" "$WEB_REPO/convex/nested" "$WEB_REPO/lib" "$HOME_DIR" "$BIN_DIR"
cp "$SCRIPT_UNDER_TEST" "$MOBILE_REPO/scripts/sync-convex-from-web.sh"
printf 'import { helper } from "../lib/helper";\nexport const marker = helper;\n' > "$WEB_REPO/convex/marker.ts"
printf 'import { helper } from "../../lib/helper";\nexport const nestedMarker = helper;\n' > "$WEB_REPO/convex/nested/marker.ts"
printf 'export const helper = true;\n' > "$WEB_REPO/lib/helper.ts"

cat > "$BIN_DIR/rsync" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
source="${@: -2:1}"
destination="${@: -1}"
cp -R "${source%/}/." "$destination"
EOF

cat > "$BIN_DIR/npx" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
exit 0
EOF

chmod +x "$BIN_DIR/rsync" "$BIN_DIR/npx"

OUTPUT="$(cd "$MOBILE_REPO" && HOME="$HOME_DIR" PATH="$BIN_DIR:$PATH" bash scripts/sync-convex-from-web.sh)"

[[ "$OUTPUT" == *"$WEB_REPO/convex/"* ]]
[[ -f "$MOBILE_REPO/convex/marker.ts" ]]

echo "PASS: sibling otopair-web checkout is selected before the shared default"
