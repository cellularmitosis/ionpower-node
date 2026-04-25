// child_process: blocking execSync / spawnSync via fork+exec+waitpid.
//
// No async child_process (spawn/exec/fork) because ionpower-node has no
// real event loop. The sync variants cover 80% of CLI use cases:
// shell outs to grep/curl/git, test runners that invoke a subprocess,
// version-probing helpers like `git rev-parse --short HEAD`.
//
// Exposed as __child_process_native__ on global; the public
// `child_process` module (in globals.cpp) wraps it.
//
// Return shape for both:
//   execSync: Buffer (stdout). Throws on non-zero exit.
//   spawnSync: { pid, status, signal, stdout, stderr, error }
//              — status is exit code or null if signaled.

#include "node_compat/globals.h"

#include <errno.h>
#include <fcntl.h>
#include <signal.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>
#include <sys/wait.h>
#include <unistd.h>
#include <string>
#include <vector>

#include "jsapi.h"
#include "jsfriendapi.h"
#include "js/Conversions.h"

namespace ionpower {

// Helper: encode a JSString* through JSAutoByteString via RootedString
// (SM45's encodeUtf8 signature requires a Handle, not raw JSString*).
static bool EncodeJSStringUtf8(JSContext* cx, JSString* raw, JSAutoByteString* out) {
    JS::RootedString s(cx, raw);
    return out->encodeUtf8(cx, s) != nullptr;
}

// Grow a malloc'd buffer. Returns new ptr (or nullptr on OOM, in which
// case *cap is unchanged). *cap is in elements, not bytes.
static char* Grow(char* buf, size_t* cap, size_t wanted) {
    size_t newCap = *cap ? *cap : 1024;
    while (newCap < wanted) newCap *= 2;
    char* nb = (char*)realloc(buf, newCap);
    if (!nb) return nullptr;
    *cap = newCap;
    return nb;
}

// Drain a file descriptor into a malloc'd buffer. On return, *out points
// to the buffer (caller frees) and *outLen is its length. Returns false
// only on allocation failure; normal read errors just terminate the loop.
static bool DrainFd(int fd, char** out, size_t* outLen) {
    size_t cap = 0, len = 0;
    char* buf = nullptr;
    char chunk[4096];
    while (true) {
        ssize_t r = read(fd, chunk, sizeof(chunk));
        if (r == 0) break;
        if (r < 0) { if (errno == EINTR) continue; break; }
        if (len + (size_t)r >= cap) {
            char* nb = Grow(buf, &cap, len + (size_t)r + 1);
            if (!nb) { free(buf); return false; }
            buf = nb;
        }
        memcpy(buf + len, chunk, (size_t)r);
        len += (size_t)r;
    }
    if (!buf) {
        buf = (char*)malloc(1);
        if (!buf) return false;
        cap = 1;
    }
    buf[len] = 0;
    *out = buf;
    *outLen = len;
    return true;
}

static JSObject* MakeBuffer(JSContext* cx, const char* data, size_t len) {
    JS::RootedObject arr(cx, JS_NewUint8Array(cx, len));
    if (!arr) return nullptr;
    if (len > 0) {
        JS::AutoCheckCannotGC nogc;
        bool shared;
        uint8_t* out = JS_GetUint8ArrayData(arr, &shared, nogc);
        if (out) memcpy(out, data, len);
    }
    return arr;
}

// Core spawn implementation. Returns status code or -1 on setup failure.
// Output buffers (stdout, stderr) are malloc'd; caller frees.
// signalOut is set to the terminating signal number if the child was
// killed, else 0.
static int DoSpawn(const char* file, char* const argv[], char* const envp[],
                   const char* cwd, const char* stdinStr, size_t stdinLen,
                   char** stdoutBuf, size_t* stdoutLen,
                   char** stderrBuf, size_t* stderrLen,
                   int* signalOut)
{
    int outPipe[2] = { -1, -1 }, errPipe[2] = { -1, -1 }, inPipe[2] = { -1, -1 };
    if (pipe(outPipe) < 0) return -1;
    if (pipe(errPipe) < 0) { close(outPipe[0]); close(outPipe[1]); return -1; }
    if (stdinStr) {
        if (pipe(inPipe) < 0) {
            close(outPipe[0]); close(outPipe[1]);
            close(errPipe[0]); close(errPipe[1]);
            return -1;
        }
    }

    pid_t pid = fork();
    if (pid < 0) {
        close(outPipe[0]); close(outPipe[1]);
        close(errPipe[0]); close(errPipe[1]);
        if (inPipe[0] >= 0) { close(inPipe[0]); close(inPipe[1]); }
        return -1;
    }

    if (pid == 0) {
        // Child: rewire stdio, close parent ends, exec.
        dup2(outPipe[1], 1); close(outPipe[0]); close(outPipe[1]);
        dup2(errPipe[1], 2); close(errPipe[0]); close(errPipe[1]);
        if (stdinStr) {
            dup2(inPipe[0], 0); close(inPipe[0]); close(inPipe[1]);
        } else {
            // Detach stdin from the parent's tty so the child doesn't
            // block trying to read.
            int devnull = open("/dev/null", O_RDONLY);
            if (devnull >= 0) { dup2(devnull, 0); close(devnull); }
        }
        if (cwd && *cwd) {
            if (chdir(cwd) < 0) { _exit(127); }
        }
        if (envp) execve(file, argv, envp);
        else      execvp(file, argv);
        _exit(127);  // exec failed
    }

    // Parent. Close child ends.
    close(outPipe[1]);
    close(errPipe[1]);
    if (stdinStr) {
        close(inPipe[0]);
        // Feed stdin. We don't worry about SIGPIPE here — if the child
        // closes early, write() returns EPIPE and we just stop.
        const char* p = stdinStr;
        size_t remain = stdinLen;
        signal(SIGPIPE, SIG_IGN);
        while (remain > 0) {
            ssize_t w = write(inPipe[1], p, remain);
            if (w <= 0) { if (errno == EINTR) continue; break; }
            p += w; remain -= (size_t)w;
        }
        close(inPipe[1]);
    }

    // Drain stdout and stderr. Single-threaded so we interleave read()s
    // via select() to avoid a blocked pipe starving the other.
    // Simple version: read stdout fully, then stderr. Works because pipe
    // buffers are usually 64K+ and most tool output fits; if not, child
    // will block on write until we read. Callers wanting very chatty
    // output can switch to real interleaving later.
    if (!DrainFd(outPipe[0], stdoutBuf, stdoutLen)) {
        close(outPipe[0]); close(errPipe[0]);
        int dummy;
        waitpid(pid, &dummy, 0);
        return -1;
    }
    close(outPipe[0]);

    if (!DrainFd(errPipe[0], stderrBuf, stderrLen)) {
        close(errPipe[0]);
        free(*stdoutBuf); *stdoutBuf = nullptr; *stdoutLen = 0;
        int dummy;
        waitpid(pid, &dummy, 0);
        return -1;
    }
    close(errPipe[0]);

    int status = 0;
    while (waitpid(pid, &status, 0) < 0) {
        if (errno != EINTR) break;
    }

    *signalOut = 0;
    if (WIFEXITED(status)) return WEXITSTATUS(status);
    if (WIFSIGNALED(status)) { *signalOut = WTERMSIG(status); return -1; }
    return -1;
}

// execSync(cmd [, opts]) — runs `sh -c <cmd>`, returns stdout.
// opts: { cwd, input, encoding } — input is string (written to stdin).
static bool ExecSync(JSContext* cx, unsigned argc, JS::Value* vp) {
    JS::CallArgs args = JS::CallArgsFromVp(argc, vp);
    if (args.length() < 1 || !args[0].isString()) {
        JS_ReportError(cx, "execSync: command string required");
        return false;
    }
    JSAutoByteString cmdBs;
    if (!EncodeJSStringUtf8(cx, args[0].toString(), &cmdBs)) return false;

    char cwdBuf[1024] = { 0 };
    const char* cwd = nullptr;
    const char* stdinStr = nullptr;
    size_t stdinLen = 0;
    std::string stdinHolder;   // keeps input alive across the call
    std::string encodingStr;
    const char* encoding = nullptr;

    if (args.length() >= 2 && args[1].isObject()) {
        JS::RootedObject o(cx, &args[1].toObject());
        JS::RootedValue v(cx);
        if (JS_GetProperty(cx, o, "cwd", &v) && v.isString()) {
            JSAutoByteString bs;
            if (EncodeJSStringUtf8(cx, v.toString(), &bs)) {
                strncpy(cwdBuf, bs.ptr(), sizeof(cwdBuf) - 1);
                cwd = cwdBuf;
            }
        }
        if (JS_GetProperty(cx, o, "input", &v)) {
            if (v.isString()) {
                JSAutoByteString bs;
                if (EncodeJSStringUtf8(cx, v.toString(), &bs)) {
                    stdinHolder.assign(bs.ptr(), strlen(bs.ptr()));
                    stdinStr = stdinHolder.c_str();
                    stdinLen = stdinHolder.size();
                }
            } else if (v.isObject() && JS_IsUint8Array(&v.toObject())) {
                JS::RootedObject a(cx, &v.toObject());
                size_t blen = JS_GetTypedArrayByteLength(a);
                JS::AutoCheckCannotGC nogc;
                bool shared;
                uint8_t* data = JS_GetUint8ArrayData(a, &shared, nogc);
                if (data) {
                    stdinHolder.assign((const char*)data, blen);
                    stdinStr = stdinHolder.c_str();
                    stdinLen = stdinHolder.size();
                }
            }
        }
        if (JS_GetProperty(cx, o, "encoding", &v) && v.isString()) {
            JSAutoByteString bs;
            if (EncodeJSStringUtf8(cx, v.toString(), &bs)) {
                encodingStr = bs.ptr();
                encoding = encodingStr.c_str();
            }
        }
    }

    const char* argvArr[4] = { "/bin/sh", "-c", cmdBs.ptr(), nullptr };
    char* stdoutBuf = nullptr; size_t stdoutLen = 0;
    char* stderrBuf = nullptr; size_t stderrLen = 0;
    int sig = 0;
    int rc = DoSpawn("/bin/sh", (char* const*)argvArr, nullptr,
                     cwd, stdinStr, stdinLen,
                     &stdoutBuf, &stdoutLen,
                     &stderrBuf, &stderrLen, &sig);

    if (rc != 0) {
        // Build a Node-style error with .status / .stdout / .stderr.
        JS::RootedObject err(cx, JS_NewPlainObject(cx));
        std::string msg = "Command failed: ";
        msg += cmdBs.ptr();
        if (stderrBuf && stderrLen > 0) {
            msg += "\n";
            msg.append(stderrBuf, stderrLen);
        }
        JS::RootedString mstr(cx, JS_NewStringCopyN(cx, msg.c_str(), msg.size()));
        if (mstr) {
            JS::RootedValue mv(cx, JS::StringValue(mstr));
            JS_DefineProperty(cx, err, "message", mv, JSPROP_ENUMERATE);
        }
        JS::RootedValue sv(cx, JS::Int32Value(rc));
        JS_DefineProperty(cx, err, "status", sv, JSPROP_ENUMERATE);
        if (stdoutBuf) {
            JS::RootedObject sobuf(cx, MakeBuffer(cx, stdoutBuf, stdoutLen));
            if (sobuf) {
                JS::RootedValue sov(cx, JS::ObjectValue(*sobuf));
                JS_DefineProperty(cx, err, "stdout", sov, JSPROP_ENUMERATE);
            }
        }
        if (stderrBuf) {
            JS::RootedObject sebuf(cx, MakeBuffer(cx, stderrBuf, stderrLen));
            if (sebuf) {
                JS::RootedValue sev(cx, JS::ObjectValue(*sebuf));
                JS_DefineProperty(cx, err, "stderr", sev, JSPROP_ENUMERATE);
            }
        }
        free(stdoutBuf); free(stderrBuf);
        JS::RootedValue errv(cx, JS::ObjectValue(*err));
        JS_SetPendingException(cx, errv);
        return false;
    }

    // Success. Return stdout as Buffer, or as string if encoding is set.
    if (encoding && (strcmp(encoding, "utf8") == 0 || strcmp(encoding, "utf-8") == 0 ||
                     strcmp(encoding, "ascii") == 0)) {
        JS::RootedString s(cx, JS_NewStringCopyN(cx, stdoutBuf ? stdoutBuf : "", stdoutLen));
        free(stdoutBuf); free(stderrBuf);
        if (!s) return false;
        args.rval().setString(s);
        return true;
    }
    JS::RootedObject out(cx, MakeBuffer(cx, stdoutBuf ? stdoutBuf : "", stdoutLen));
    free(stdoutBuf); free(stderrBuf);
    if (!out) return false;
    args.rval().setObject(*out);
    return true;
}

// spawnSync(file, argsArray [, opts]) — returns the full result object.
static bool SpawnSync(JSContext* cx, unsigned argc, JS::Value* vp) {
    JS::CallArgs args = JS::CallArgsFromVp(argc, vp);
    if (args.length() < 1 || !args[0].isString()) {
        JS_ReportError(cx, "spawnSync: file string required");
        return false;
    }
    JSAutoByteString fileBs;
    if (!EncodeJSStringUtf8(cx, args[0].toString(), &fileBs)) return false;

    // Collect args array.
    std::vector<std::string> argsHolder;
    argsHolder.push_back(fileBs.ptr());
    if (args.length() >= 2 && args[1].isObject()) {
        JS::RootedObject arrObj(cx, &args[1].toObject());
        bool isArr = false;
        JS_IsArrayObject(cx, arrObj, &isArr);
        if (isArr) {
            uint32_t len = 0;
            JS_GetArrayLength(cx, arrObj, &len);
            for (uint32_t i = 0; i < len; ++i) {
                JS::RootedValue v(cx);
                JS_GetElement(cx, arrObj, i, &v);
                if (v.isString()) {
                    JSAutoByteString bs;
                    if (EncodeJSStringUtf8(cx, v.toString(), &bs)) argsHolder.push_back(bs.ptr());
                }
            }
        }
    }

    char cwdBuf[1024] = { 0 };
    const char* cwd = nullptr;
    const char* stdinStr = nullptr;
    size_t stdinLen = 0;
    std::string stdinHolder;
    std::string encodingStr;
    const char* encoding = nullptr;
    int optsIdx = (args.length() >= 3 && args[2].isObject()) ? 2 : -1;
    if (optsIdx >= 0) {
        JS::RootedObject o(cx, &args[optsIdx].toObject());
        JS::RootedValue v(cx);
        if (JS_GetProperty(cx, o, "cwd", &v) && v.isString()) {
            JSAutoByteString bs;
            if (EncodeJSStringUtf8(cx, v.toString(), &bs)) {
                strncpy(cwdBuf, bs.ptr(), sizeof(cwdBuf) - 1);
                cwd = cwdBuf;
            }
        }
        if (JS_GetProperty(cx, o, "input", &v)) {
            if (v.isString()) {
                JSAutoByteString bs;
                if (EncodeJSStringUtf8(cx, v.toString(), &bs)) {
                    stdinHolder.assign(bs.ptr(), strlen(bs.ptr()));
                    stdinStr = stdinHolder.c_str();
                    stdinLen = stdinHolder.size();
                }
            } else if (v.isObject() && JS_IsUint8Array(&v.toObject())) {
                JS::RootedObject a(cx, &v.toObject());
                size_t blen = JS_GetTypedArrayByteLength(a);
                JS::AutoCheckCannotGC nogc;
                bool shared;
                uint8_t* data = JS_GetUint8ArrayData(a, &shared, nogc);
                if (data) {
                    stdinHolder.assign((const char*)data, blen);
                    stdinStr = stdinHolder.c_str();
                    stdinLen = stdinHolder.size();
                }
            }
        }
        if (JS_GetProperty(cx, o, "encoding", &v) && v.isString()) {
            JSAutoByteString bs;
            if (EncodeJSStringUtf8(cx, v.toString(), &bs)) {
                encodingStr = bs.ptr();
                encoding = encodingStr.c_str();
            }
        }
    }

    std::vector<char*> argvVec;
    for (size_t i = 0; i < argsHolder.size(); ++i)
        argvVec.push_back(const_cast<char*>(argsHolder[i].c_str()));
    argvVec.push_back(nullptr);

    char* stdoutBuf = nullptr; size_t stdoutLen = 0;
    char* stderrBuf = nullptr; size_t stderrLen = 0;
    int sig = 0;
    int rc = DoSpawn(fileBs.ptr(), argvVec.data(), nullptr,
                     cwd, stdinStr, stdinLen,
                     &stdoutBuf, &stdoutLen,
                     &stderrBuf, &stderrLen, &sig);

    JS::RootedObject result(cx, JS_NewPlainObject(cx));
    if (!result) { free(stdoutBuf); free(stderrBuf); return false; }

    JS::RootedValue pidV(cx, JS::Int32Value(-1));  // pid unavailable post-wait
    JS_DefineProperty(cx, result, "pid", pidV, JSPROP_ENUMERATE);
    JS::RootedValue statusV(cx);
    if (sig > 0) statusV.setNull();
    else         statusV.setInt32(rc);
    JS_DefineProperty(cx, result, "status", statusV, JSPROP_ENUMERATE);
    JS::RootedValue sigV(cx);
    if (sig > 0) {
        // Node uses the signal *name*, not number. Cover the usual suspects.
        const char* sigName = "UNKNOWN";
        switch (sig) {
            case 1:  sigName = "SIGHUP";  break;
            case 2:  sigName = "SIGINT";  break;
            case 9:  sigName = "SIGKILL"; break;
            case 15: sigName = "SIGTERM"; break;
            case 11: sigName = "SIGSEGV"; break;
            case 6:  sigName = "SIGABRT"; break;
        }
        sigV.setString(JS_NewStringCopyZ(cx, sigName));
    } else sigV.setNull();
    JS_DefineProperty(cx, result, "signal", sigV, JSPROP_ENUMERATE);

    bool wantString = encoding && (strcmp(encoding, "utf8") == 0 ||
                                   strcmp(encoding, "utf-8") == 0 ||
                                   strcmp(encoding, "ascii") == 0);

    // stdout
    {
        JS::RootedValue v(cx);
        if (wantString) {
            JS::RootedString s(cx, JS_NewStringCopyN(cx, stdoutBuf ? stdoutBuf : "", stdoutLen));
            if (s) v.setString(s);
        } else {
            JS::RootedObject b(cx, MakeBuffer(cx, stdoutBuf ? stdoutBuf : "", stdoutLen));
            if (b) v.setObject(*b);
        }
        JS_DefineProperty(cx, result, "stdout", v, JSPROP_ENUMERATE);
    }
    // stderr
    {
        JS::RootedValue v(cx);
        if (wantString) {
            JS::RootedString s(cx, JS_NewStringCopyN(cx, stderrBuf ? stderrBuf : "", stderrLen));
            if (s) v.setString(s);
        } else {
            JS::RootedObject b(cx, MakeBuffer(cx, stderrBuf ? stderrBuf : "", stderrLen));
            if (b) v.setObject(*b);
        }
        JS_DefineProperty(cx, result, "stderr", v, JSPROP_ENUMERATE);
    }

    free(stdoutBuf); free(stderrBuf);
    args.rval().setObject(*result);
    return true;
}

// spawnAsync(file, args, opts) — non-blocking fork+exec.
// Returns { pid, stdinFd, stdoutFd, stderrFd }. The caller plumbs the
// fds through the event-loop ioWatch primitive and registers a child
// exit callback via childRegister(pid). All pipe fds are set
// non-blocking so reads don't stall the event loop.
static bool SpawnAsync(JSContext* cx, unsigned argc, JS::Value* vp) {
    JS::CallArgs args = JS::CallArgsFromVp(argc, vp);
    if (args.length() < 1 || !args[0].isString()) {
        JS_ReportError(cx, "spawnAsync: file string required");
        return false;
    }
    JSAutoByteString fileBs;
    if (!EncodeJSStringUtf8(cx, args[0].toString(), &fileBs)) return false;

    std::vector<std::string> argsHolder;
    argsHolder.push_back(fileBs.ptr());
    if (args.length() >= 2 && args[1].isObject()) {
        JS::RootedObject arrObj(cx, &args[1].toObject());
        bool isArr = false;
        JS_IsArrayObject(cx, arrObj, &isArr);
        if (isArr) {
            uint32_t len = 0;
            JS_GetArrayLength(cx, arrObj, &len);
            for (uint32_t i = 0; i < len; ++i) {
                JS::RootedValue v(cx);
                JS_GetElement(cx, arrObj, i, &v);
                if (v.isString()) {
                    JSAutoByteString bs;
                    if (EncodeJSStringUtf8(cx, v.toString(), &bs)) argsHolder.push_back(bs.ptr());
                }
            }
        }
    }

    char cwdBuf[1024] = { 0 };
    const char* cwd = nullptr;
    // env is built into a NUL-terminated KEY=VAL array passed via execve.
    // Holders must outlive the fork's child branch; keep them in vectors
    // declared at this scope.
    std::vector<std::string> envHolder;
    bool useEnv = false;
    if (args.length() >= 3 && args[2].isObject()) {
        JS::RootedObject o(cx, &args[2].toObject());
        JS::RootedValue v(cx);
        if (JS_GetProperty(cx, o, "cwd", &v) && v.isString()) {
            JSAutoByteString bs;
            if (EncodeJSStringUtf8(cx, v.toString(), &bs)) {
                strncpy(cwdBuf, bs.ptr(), sizeof(cwdBuf) - 1);
                cwd = cwdBuf;
            }
        }
        JS::RootedValue envV(cx);
        if (JS_GetProperty(cx, o, "env", &envV) && envV.isObject()) {
            JS::RootedObject envObj(cx, &envV.toObject());
            JS::Rooted<JS::IdVector> ids(cx, JS::IdVector(cx));
            if (JS_Enumerate(cx, envObj, &ids)) {
                for (size_t i = 0; i < ids.length(); ++i) {
                    JS::RootedId id(cx, ids[i]);
                    JS::RootedValue val(cx);
                    if (!JS_GetPropertyById(cx, envObj, id, &val)) continue;
                    if (!val.isString() && !val.isNumber() && !val.isBoolean()) continue;
                    JS::RootedValue keyV(cx);
                    if (!JS_IdToValue(cx, id, &keyV)) continue;
                    JS::RootedString keyS(cx, JS::ToString(cx, keyV));
                    if (!keyS) continue;
                    JS::RootedString valS(cx, JS::ToString(cx, val));
                    if (!valS) continue;
                    JSAutoByteString keyBs, valBs;
                    if (!EncodeJSStringUtf8(cx, keyS, &keyBs)) continue;
                    if (!EncodeJSStringUtf8(cx, valS, &valBs)) continue;
                    std::string entry = keyBs.ptr();
                    entry += '=';
                    entry += valBs.ptr();
                    envHolder.push_back(entry);
                }
            }
            useEnv = true;
        }
    }

    int inPipe[2], outPipe[2], errPipe[2];
    if (pipe(inPipe)  < 0) { JS_ReportError(cx, "spawnAsync: pipe(stdin) failed"); return false; }
    if (pipe(outPipe) < 0) { close(inPipe[0]); close(inPipe[1]);
                             JS_ReportError(cx, "spawnAsync: pipe(stdout) failed"); return false; }
    if (pipe(errPipe) < 0) { close(inPipe[0]); close(inPipe[1]); close(outPipe[0]); close(outPipe[1]);
                             JS_ReportError(cx, "spawnAsync: pipe(stderr) failed"); return false; }

    pid_t pid = fork();
    if (pid < 0) {
        close(inPipe[0]);  close(inPipe[1]);
        close(outPipe[0]); close(outPipe[1]);
        close(errPipe[0]); close(errPipe[1]);
        JS_ReportError(cx, "spawnAsync: fork failed: %s", strerror(errno));
        return false;
    }

    if (pid == 0) {
        // Child
        dup2(inPipe[0],  0); close(inPipe[0]);  close(inPipe[1]);
        dup2(outPipe[1], 1); close(outPipe[0]); close(outPipe[1]);
        dup2(errPipe[1], 2); close(errPipe[0]); close(errPipe[1]);
        if (cwd && *cwd) { if (chdir(cwd) < 0) _exit(127); }
        std::vector<char*> argvVec;
        for (size_t i = 0; i < argsHolder.size(); ++i)
            argvVec.push_back(const_cast<char*>(argsHolder[i].c_str()));
        argvVec.push_back(nullptr);
        if (useEnv) {
            // Replace the child's environment in-place so execvp's PATH
            // search keeps working (execve wants an absolute path).
            // We're in the forked child, so this only affects us.
            // setenv replaces if present; we first wipe by setting environ to
            // an empty array via a malloc'd dummy.
            for (size_t i = 0; i < envHolder.size(); ++i) {
                const char* eq = strchr(envHolder[i].c_str(), '=');
                if (!eq) continue;
                std::string key(envHolder[i].c_str(), eq - envHolder[i].c_str());
                setenv(key.c_str(), eq + 1, 1);
            }
        }
        execvp(fileBs.ptr(), argvVec.data());
        _exit(127);
    }

    // Parent — close child ends, mark parent ends non-blocking.
    close(inPipe[0]);
    close(outPipe[1]);
    close(errPipe[1]);
    fcntl(inPipe[1],  F_SETFL, O_NONBLOCK);
    fcntl(outPipe[0], F_SETFL, O_NONBLOCK);
    fcntl(errPipe[0], F_SETFL, O_NONBLOCK);

    JS::RootedObject result(cx, JS_NewPlainObject(cx));
    if (!result) return false;
    JS::RootedValue v(cx);
    v.setInt32((int32_t)pid);          JS_DefineProperty(cx, result, "pid",       v, JSPROP_ENUMERATE);
    v.setInt32(inPipe[1]);             JS_DefineProperty(cx, result, "stdinFd",   v, JSPROP_ENUMERATE);
    v.setInt32(outPipe[0]);            JS_DefineProperty(cx, result, "stdoutFd",  v, JSPROP_ENUMERATE);
    v.setInt32(errPipe[0]);            JS_DefineProperty(cx, result, "stderrFd",  v, JSPROP_ENUMERATE);
    args.rval().setObject(*result);
    return true;
}

// readFd(fd, maxBytes) -> { bytes: Buffer, eof: bool, wouldBlock: bool }
// Non-blocking read. `eof` true iff read() returned 0; `wouldBlock` true
// iff EAGAIN/EWOULDBLOCK.
static bool ReadFd(JSContext* cx, unsigned argc, JS::Value* vp) {
    JS::CallArgs args = JS::CallArgsFromVp(argc, vp);
    if (args.length() < 1) { JS_ReportError(cx, "readFd: fd required"); return false; }
    int32_t fd = 0;
    if (!JS::ToInt32(cx, args[0], &fd)) return false;
    int32_t maxBytes = 65536;
    if (args.length() >= 2) JS::ToInt32(cx, args[1], &maxBytes);
    if (maxBytes <= 0 || maxBytes > 1024*1024) maxBytes = 65536;

    std::vector<char> buf((size_t)maxBytes);
    ssize_t r = read(fd, buf.data(), (size_t)maxBytes);
    int saved_errno = errno;

    JS::RootedObject result(cx, JS_NewPlainObject(cx));
    if (!result) return false;
    JS::RootedValue v(cx);

    if (r > 0) {
        JS::RootedObject arr(cx, JS_NewUint8Array(cx, (uint32_t)r));
        if (!arr) return false;
        {
            JS::AutoCheckCannotGC nogc;
            bool shared;
            uint8_t* out = JS_GetUint8ArrayData(arr, &shared, nogc);
            if (out) memcpy(out, buf.data(), (size_t)r);
        }
        v.setObject(*arr); JS_DefineProperty(cx, result, "bytes",      v, JSPROP_ENUMERATE);
        v.setBoolean(false); JS_DefineProperty(cx, result, "eof",        v, JSPROP_ENUMERATE);
        v.setBoolean(false); JS_DefineProperty(cx, result, "wouldBlock", v, JSPROP_ENUMERATE);
    } else if (r == 0) {
        v.setNull();         JS_DefineProperty(cx, result, "bytes",      v, JSPROP_ENUMERATE);
        v.setBoolean(true);  JS_DefineProperty(cx, result, "eof",        v, JSPROP_ENUMERATE);
        v.setBoolean(false); JS_DefineProperty(cx, result, "wouldBlock", v, JSPROP_ENUMERATE);
    } else {
        bool would = (saved_errno == EAGAIN || saved_errno == EWOULDBLOCK);
        v.setNull();         JS_DefineProperty(cx, result, "bytes",      v, JSPROP_ENUMERATE);
        v.setBoolean(false); JS_DefineProperty(cx, result, "eof",        v, JSPROP_ENUMERATE);
        v.setBoolean(would); JS_DefineProperty(cx, result, "wouldBlock", v, JSPROP_ENUMERATE);
        if (!would) {
            v.setInt32(saved_errno);
            JS_DefineProperty(cx, result, "errno", v, JSPROP_ENUMERATE);
        }
    }
    args.rval().setObject(*result);
    return true;
}

// writeFd(fd, bytesOrString) -> { written: int, wouldBlock: bool }
static bool WriteFd(JSContext* cx, unsigned argc, JS::Value* vp) {
    JS::CallArgs args = JS::CallArgsFromVp(argc, vp);
    if (args.length() < 2) { JS_ReportError(cx, "writeFd: fd + data required"); return false; }
    int32_t fd = 0;
    if (!JS::ToInt32(cx, args[0], &fd)) return false;

    const char* data = nullptr;
    size_t len = 0;
    std::string str;

    if (args[1].isString()) {
        JSAutoByteString bs;
        if (!EncodeJSStringUtf8(cx, args[1].toString(), &bs)) return false;
        str.assign(bs.ptr(), strlen(bs.ptr()));
        data = str.data(); len = str.size();
    } else if (args[1].isObject() && JS_IsUint8Array(&args[1].toObject())) {
        JS::RootedObject a(cx, &args[1].toObject());
        len = JS_GetTypedArrayByteLength(a);
        JS::AutoCheckCannotGC nogc;
        bool shared;
        uint8_t* d = JS_GetUint8ArrayData(a, &shared, nogc);
        if (d) { str.assign((const char*)d, len); data = str.data(); }
    } else {
        JS_ReportError(cx, "writeFd: data must be string or Uint8Array");
        return false;
    }

    ssize_t w = write(fd, data, len);
    int saved_errno = errno;

    JS::RootedObject result(cx, JS_NewPlainObject(cx));
    if (!result) return false;
    JS::RootedValue v(cx);
    if (w >= 0) {
        v.setInt32((int32_t)w); JS_DefineProperty(cx, result, "written",    v, JSPROP_ENUMERATE);
        v.setBoolean(false);    JS_DefineProperty(cx, result, "wouldBlock", v, JSPROP_ENUMERATE);
    } else {
        bool would = (saved_errno == EAGAIN || saved_errno == EWOULDBLOCK);
        v.setInt32(0);          JS_DefineProperty(cx, result, "written",    v, JSPROP_ENUMERATE);
        v.setBoolean(would);    JS_DefineProperty(cx, result, "wouldBlock", v, JSPROP_ENUMERATE);
        if (!would) { v.setInt32(saved_errno); JS_DefineProperty(cx, result, "errno", v, JSPROP_ENUMERATE); }
    }
    args.rval().setObject(*result);
    return true;
}

// closeFd(fd)
static bool CloseFd(JSContext* cx, unsigned argc, JS::Value* vp) {
    JS::CallArgs args = JS::CallArgsFromVp(argc, vp);
    int32_t fd = 0;
    if (args.length() >= 1 && JS::ToInt32(cx, args[0], &fd)) close(fd);
    args.rval().setUndefined();
    return true;
}

// killPid(pid, sig) — wraps libc kill(2). Returns 0 on success or
// the errno on failure. SIGTERM (15) is the default if sig is omitted.
static bool KillPid(JSContext* cx, unsigned argc, JS::Value* vp) {
    JS::CallArgs args = JS::CallArgsFromVp(argc, vp);
    int32_t pid = 0;
    int32_t sig = 15; // SIGTERM
    if (args.length() < 1 || !JS::ToInt32(cx, args[0], &pid)) {
        JS_ReportError(cx, "killPid: pid required");
        return false;
    }
    if (args.length() >= 2 && !JS::ToInt32(cx, args[1], &sig)) return false;
    int rc = kill((pid_t)pid, sig);
    args.rval().setInt32(rc == 0 ? 0 : errno);
    return true;
}

bool InstallChildProcess(JSContext* cx, JS::HandleObject global) {
    JS::RootedObject cp(cx, JS_NewPlainObject(cx));
    if (!cp) return false;
    if (!JS_DefineFunction(cx, cp, "execSync",   ExecSync,   1, JSPROP_ENUMERATE)) return false;
    if (!JS_DefineFunction(cx, cp, "spawnSync",  SpawnSync,  2, JSPROP_ENUMERATE)) return false;
    if (!JS_DefineFunction(cx, cp, "spawnAsync", SpawnAsync, 2, JSPROP_ENUMERATE)) return false;
    if (!JS_DefineFunction(cx, cp, "readFd",     ReadFd,     2, JSPROP_ENUMERATE)) return false;
    if (!JS_DefineFunction(cx, cp, "writeFd",    WriteFd,    2, JSPROP_ENUMERATE)) return false;
    if (!JS_DefineFunction(cx, cp, "closeFd",    CloseFd,    1, JSPROP_ENUMERATE)) return false;
    if (!JS_DefineFunction(cx, cp, "killPid",    KillPid,    2, JSPROP_ENUMERATE)) return false;
    return JS_DefineProperty(cx, global, "__child_process_native__", cp,
                             JSPROP_ENUMERATE);
}

} // namespace ionpower
