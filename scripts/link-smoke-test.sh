#!/bin/bash
# On the target host, compile and link a tiny program that just does
# JS_Init / JS_NewRuntime / JS_ShutDown. Confirms the mozjs install is
# link-usable before we tangle with the full bridge.
set -e
MOZJS_PREFIX=${MOZJS_PREFIX:-/opt/mozjs-45-ionpower}
SCRATCH=${SCRATCH:-/Users/macuser/tmp}

cat > "$SCRATCH/link-smoke.cpp" <<'CPP'
#include <stdio.h>
#include "jsapi.h"
#include "js/Initialization.h"
int main() {
    if (!JS_Init()) { printf("JS_Init FAIL\n"); return 1; }
    JSRuntime* rt = JS_NewRuntime(8L * 1024L * 1024L, 2L * 1024L * 1024L);
    if (!rt) { printf("JS_NewRuntime FAIL\n"); JS_ShutDown(); return 1; }
    printf("ok: runtime created\n");
    JS_DestroyRuntime(rt);
    JS_ShutDown();
    return 0;
}
CPP

CXX=/opt/gcc-4.9.4/bin/g++-4.9
$CXX \
    -m32 -mmacosx-version-min=10.4 -mcpu=G5 -D_PPC970_ \
    -std=gnu++0x -fpermissive -fno-exceptions -fno-rtti \
    -I "$MOZJS_PREFIX/include/mozjs-45" \
    -L "$MOZJS_PREFIX/lib" \
    "$SCRATCH/link-smoke.cpp" \
    -o "$SCRATCH/link-smoke" \
    -lmozjs-45 -lmozglue -lpthread -lm -lz \
    -framework Carbon -framework ExceptionHandling -lobjc \
    -Wl,-stack_size,0x10000000

echo "linked $SCRATCH/link-smoke"
"$SCRATCH/link-smoke"
