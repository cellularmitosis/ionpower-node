#!/bin/bash
# Run on ibookg37 (G3) to surface gaps in npm install <real-deptree>.
# Targets express (40+ deps), handlebars (smaller), ws (no deps).
# Captures stdout+stderr + an env trace.

set +e   # Capture failures, don't bail.

NODE_BIN=${NODE_BIN:-/Users/macuser/tmp/ionpower-node/node}
NPM_WRAPPER=/Users/macuser/tmp/npm-6.14.18/run-npm.js
WORK=${WORK:-/Users/macuser/tmp/express-discovery}
LOG=${LOG:-$WORK/discovery.log}

rm -rf "$WORK"
mkdir -p "$WORK"
cd "$WORK"

cat > package.json <<'EOF'
{
  "name": "ionpower-node-express-discovery",
  "version": "0.0.0",
  "private": true,
  "dependencies": {}
}
EOF

{
  echo "=== ionpower-node ==="
  "$NODE_BIN" -e 'console.log("version:", process.version); console.log("versions:", JSON.stringify(process.versions))'
  echo
  echo "=== npm install express ==="
  "$NODE_BIN" "$NPM_WRAPPER" install express --registry=https://registry.npmjs.org 2>&1
  echo
  echo "=== exit: $? ==="
  echo
  echo "=== ls node_modules ==="
  ls node_modules 2>&1 | sort
  echo
  echo "=== node_modules count ==="
  find node_modules -maxdepth 2 -name package.json | wc -l
} | tee "$LOG"
