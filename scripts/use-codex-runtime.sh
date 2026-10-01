# Source this file from the repo root when Node/pnpm are not on this workstation's PATH.
if ! command -v node >/dev/null 2>&1 || ! command -v pnpm >/dev/null 2>&1; then
  GOLFWORLD_RUNTIME="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies"
  if [ -x "$GOLFWORLD_RUNTIME/node/bin/node" ] && [ -x "$GOLFWORLD_RUNTIME/bin/fallback/pnpm" ]; then
    export PATH="$GOLFWORLD_RUNTIME/node/bin:$GOLFWORLD_RUNTIME/bin/fallback:$PATH"
  else
    echo "Install Node 22.12+ and pnpm 11.19.0, then retry."
    return 1
  fi
fi
