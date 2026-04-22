// ionpower-node: a Node.js-compatible JavaScript runtime for PowerPC Tiger.
//
// Links against TenFourFox's SpiderMonkey 45 (with the IonPower 32-bit PPC
// JIT). Exposes a subset of Node's API surface: console, process, fs (sync),
// path, Buffer-ish, and a CommonJS require() for relative-path modules.
//
// Reference: TenFourFox's own js/src/shell/js.cpp demonstrates the embedding
// pattern. See docs/plan.md for scope and design.

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "jsapi.h"
#include "js/Conversions.h"
#include "js/Initialization.h"

#include "node_compat/globals.h"

using namespace JS;

static const JSClass kGlobalClass = {
    "global",
    JSCLASS_GLOBAL_FLAGS,
    nullptr, nullptr, nullptr, nullptr,
    nullptr, nullptr, nullptr, nullptr,
    nullptr, nullptr, nullptr,
    JS_GlobalObjectTraceHook
};

static void ReportError(JSContext* cx, const char* message, JSErrorReport* report)
{
    fprintf(stderr, "%s:%u: %s\n",
            report->filename ? report->filename : "<no filename>",
            (unsigned)report->lineno,
            message);
}

static int RunMain(JSContext* cx, int argc, char** argv)
{
    CompartmentOptions options;
    options.setVersion(JSVERSION_LATEST);
    RootedObject global(cx, JS_NewGlobalObject(cx, &kGlobalClass, nullptr,
                                               JS::DontFireOnNewGlobalHook, options));
    if (!global) {
        fprintf(stderr, "ionpower-node: JS_NewGlobalObject failed\n");
        return 1;
    }

    JSAutoCompartment ac(cx, global);
    if (!JS_InitStandardClasses(cx, global)) {
        fprintf(stderr, "ionpower-node: JS_InitStandardClasses failed\n");
        return 1;
    }

    if (!ionpower::InstallNodeCompatGlobals(cx, global, argc, argv)) {
        fprintf(stderr, "ionpower-node: failed to install Node-compat globals\n");
        return 1;
    }

    JS_FireOnNewGlobalObject(cx, global);

    if (argc < 2) {
        fprintf(stderr, "usage: %s <script.js> [args...]\n",
                argc >= 1 ? argv[0] : "node");
        return 2;
    }

    const char* entry_script = argv[1];
    bool ok = ionpower::RunEntryScript(cx, global, entry_script);
    if (!ok) {
        // Drain any pending exception through the error reporter so the user
        // sees a stack / message rather than a silent exit.
        if (JS_IsExceptionPending(cx))
            JS_ReportPendingException(cx);
    }
    return ok ? 0 : 1;
}

int main(int argc, char** argv)
{
    if (!JS_Init()) {
        fprintf(stderr, "ionpower-node: JS_Init failed\n");
        return 1;
    }

    // SpiderMonkey 45 wants a 32 MB default heap, 2 MB nursery. These are
    // the same numbers the js shell and Firefox use.
    JSRuntime* rt = JS_NewRuntime(32L * 1024L * 1024L, 2L * 1024L * 1024L);
    if (!rt) {
        fprintf(stderr, "ionpower-node: JS_NewRuntime failed\n");
        JS_ShutDown();
        return 1;
    }
    JS_SetErrorReporter(rt, ReportError);
    JS_SetNativeStackQuota(rt, 2 * 1024 * 1024);

    JSContext* cx = JS_NewContext(rt, 8192);
    if (!cx) {
        fprintf(stderr, "ionpower-node: JS_NewContext failed\n");
        JS_DestroyRuntime(rt);
        JS_ShutDown();
        return 1;
    }

    int rc = RunMain(cx, argc, argv);

    JS_DestroyContext(cx);
    JS_DestroyRuntime(rt);
    JS_ShutDown();
    return rc;
}
