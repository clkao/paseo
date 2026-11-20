#!/usr/bin/env bash
set -eu
a="$PWD/.dev/validation-66805ba"
export PASEO_HOME="$a/daemon" PASEO_ELECTRON_USER_DATA_DIR="$a/profile" XDG_CONFIG_HOME="$a/xdg" PASEO_TEST_APP_NAME='Paseo Scope Validation'
export PASEO_ELECTRON_FLAGS='--remote-debugging-address=127.0.0.1 --remote-debugging-port=24770' EXPO_DEV_URL='http://127.0.0.1:24768'
exec xvfb-run -a -s '-screen 0 1440x1000x24' node_modules/.bin/electron packages/desktop
