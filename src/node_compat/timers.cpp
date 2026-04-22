// Minimal "timers" shim.
//
// ionpower-node has no event loop yet, so we can't honor a real delay.
// Instead we accept the Node API shape and execute callbacks synchronously:
//
//   setImmediate(fn, ...args)         -> call fn(...args) immediately, return 0
//   setTimeout(fn, delay, ...args)    -> call fn(...args) immediately, return 0
//   clearImmediate(id)                -> no-op
//   clearTimeout(id)                  -> no-op
//
// This is wrong relative to Node but produces correct-enough behavior for
// scripts that schedule work "for later" without relying on actual ordering.
// Anything that depends on asynchrony (network I/O, file events, etc.) is
// out of scope for this runtime.

#include "node_compat/globals.h"

#include "jsapi.h"
#include "js/Conversions.h"

namespace ionpower {

static bool RunCallbackImmediately(JSContext* cx, unsigned firstArgIdx,
                                   const JS::CallArgs& args,
                                   JS::MutableHandleValue rval)
{
    if (args.length() <= firstArgIdx) {
        rval.setInt32(0);
        return true;
    }
    JS::RootedValue fn(cx, args[firstArgIdx]);
    if (!fn.isObject() || !JS_ObjectIsFunction(cx, &fn.toObject())) {
        // Not a function — Node would throw; we match.
        JS_ReportError(cx, "timers: callback is not a function");
        return false;
    }

    unsigned forwarded = args.length() - (firstArgIdx + 1);
    JS::AutoValueVector passArgs(cx);
    if (!passArgs.resize(forwarded))
        return false;
    for (unsigned i = 0; i < forwarded; ++i)
        passArgs[i].set(args[firstArgIdx + 1 + i]);

    JS::HandleValueArray ha(passArgs);
    JS::RootedValue discard(cx);
    if (!JS::Call(cx, JS::UndefinedHandleValue, fn, ha, &discard))
        return false;
    rval.setInt32(0);
    return true;
}

static bool TimerImmediate(JSContext* cx, unsigned argc, JS::Value* vp) {
    JS::CallArgs args = JS::CallArgsFromVp(argc, vp);
    JS::RootedValue out(cx);
    if (!RunCallbackImmediately(cx, /*firstArgIdx=*/0, args, &out))
        return false;
    args.rval().set(out);
    return true;
}

static bool TimerTimeout(JSContext* cx, unsigned argc, JS::Value* vp) {
    // args: (fn, delay?, ...forwarded)
    JS::CallArgs args = JS::CallArgsFromVp(argc, vp);
    // We ignore args[1] (the delay); effective index of forwarded args is 2.
    // But for the "first arg" used by RunCallbackImmediately, we pass 0 and
    // manually skip: easier to just take a one-shot path.
    if (args.length() < 1) {
        args.rval().setInt32(0);
        return true;
    }
    JS::RootedValue fn(cx, args[0]);
    if (!fn.isObject() || !JS_ObjectIsFunction(cx, &fn.toObject())) {
        JS_ReportError(cx, "setTimeout: callback is not a function");
        return false;
    }
    unsigned forwarded = (args.length() >= 2) ? (args.length() - 2) : 0;
    JS::AutoValueVector passArgs(cx);
    if (!passArgs.resize(forwarded))
        return false;
    for (unsigned i = 0; i < forwarded; ++i)
        passArgs[i].set(args[2 + i]);
    JS::HandleValueArray ha(passArgs);
    JS::RootedValue discard(cx);
    if (!JS::Call(cx, JS::UndefinedHandleValue, fn, ha, &discard))
        return false;
    args.rval().setInt32(0);
    return true;
}

static bool TimerClear(JSContext* cx, unsigned argc, JS::Value* vp) {
    JS::CallArgs args = JS::CallArgsFromVp(argc, vp);
    args.rval().setUndefined();
    return true;
}

static const JSFunctionSpec kTimerFuncs[] = {
    JS_FN("setImmediate",   TimerImmediate, 1, 0),
    JS_FN("clearImmediate", TimerClear,     1, 0),
    JS_FN("setTimeout",     TimerTimeout,   2, 0),
    JS_FN("clearTimeout",   TimerClear,     1, 0),
    JS_FN("setInterval",    TimerTimeout,   2, 0), // no-loop: fires once
    JS_FN("clearInterval",  TimerClear,     1, 0),
    JS_FS_END
};

bool InstallTimers(JSContext* cx, JS::HandleObject global) {
    return JS_DefineFunctions(cx, global, kTimerFuncs);
}

} // namespace ionpower
