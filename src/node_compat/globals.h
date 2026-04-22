#ifndef IONPOWER_NODE_COMPAT_GLOBALS_H
#define IONPOWER_NODE_COMPAT_GLOBALS_H

#include "jsapi.h"

namespace ionpower {

// Attach all Node-compat API surfaces (console, process, fs, path, Buffer,
// require) onto `global`. argc/argv are plumbed into process.argv.
bool InstallNodeCompatGlobals(JSContext* cx, JS::HandleObject global,
                              int argc, char** argv);

// Compile and execute the user's entry script at `path`. This wraps the
// script in a CommonJS module so `require`, `module`, `exports`,
// `__filename`, and `__dirname` are in scope.
bool RunEntryScript(JSContext* cx, JS::HandleObject global, const char* path);

// --- Individual module installers, in case a test wants only some. ---
bool InstallConsole(JSContext* cx, JS::HandleObject global);
bool InstallProcess(JSContext* cx, JS::HandleObject global,
                    int argc, char** argv);
bool InstallFsSync(JSContext* cx, JS::HandleObject global);
bool InstallPath(JSContext* cx, JS::HandleObject global);
bool InstallBuffer(JSContext* cx, JS::HandleObject global);
bool InstallRequire(JSContext* cx, JS::HandleObject global);
bool InstallTimers(JSContext* cx, JS::HandleObject global);

} // namespace ionpower

#endif // IONPOWER_NODE_COMPAT_GLOBALS_H
