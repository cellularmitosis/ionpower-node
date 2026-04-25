// http: a blocking HTTP client shelled out to /opt/tigersh-deps-0.1/bin/curl.
//
// There's no event loop on ionpower-node, so http.getSync / postSync block
// on the curl subprocess. Intended for simple fetches: APIs returning JSON,
// downloading a file, etc. Return shape:
//     { status: number, headers: { name: value, ... }, body: string|Uint8Array }
//
// curl's flag set here:
//     -sS  silent + errors on stderr
//     -o   write body to temp file
//     -D   dump response headers to temp file
//     -w   print only the HTTP status to stdout
//     -A   ionpower-node user agent
//     --max-time <sec>   hard timeout
//     --cacert <pem>     bundled CA bundle when present
//     --insecure         opt-in via options.insecure = true

#include "node_compat/globals.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <errno.h>
#include <unistd.h>
#include <fcntl.h>
#include <sys/stat.h>
#include <sys/wait.h>

#include "jsapi.h"
#include "jsfriendapi.h"
#include "js/Conversions.h"
#include "js/CharacterEncoding.h"

namespace ionpower {

// Scan $PATH (plus a couple of /opt defaults) for a working curl.
static bool FindCurl(char* out, size_t outsz) {
    static const char* candidates[] = {
        "/opt/tigersh-deps-0.1/bin/curl",
        "/usr/local/bin/curl",
        "/usr/bin/curl",
        NULL
    };
    for (int i = 0; candidates[i]; ++i) {
        struct stat st;
        if (stat(candidates[i], &st) == 0 && (st.st_mode & S_IXUSR)) {
            strncpy(out, candidates[i], outsz);
            out[outsz - 1] = 0;
            return true;
        }
    }
    return false;
}

// Default CA bundle path on the TigerTube fleet.
static const char* FindCaBundle(void) {
    static const char* candidates[] = {
        "/Users/macuser/tmp/cacert-2026-03-19.pem",
        "/opt/ca-certificates-20230110/share/cacert.pem",
        "/opt/ca-certificates-20221011/share/cacert.pem",
        NULL
    };
    for (int i = 0; candidates[i]; ++i) {
        struct stat st;
        if (stat(candidates[i], &st) == 0) return candidates[i];
    }
    return NULL;
}

static bool ReadFileToString(const char* path, char** out, size_t* outLen) {
    FILE* f = fopen(path, "rb");
    if (!f) return false;
    if (fseek(f, 0, SEEK_END) != 0) { fclose(f); return false; }
    long sz = ftell(f);
    if (sz < 0) { fclose(f); return false; }
    rewind(f);
    char* buf = (char*)malloc((size_t)sz + 1);
    if (!buf) { fclose(f); return false; }
    size_t r = fread(buf, 1, (size_t)sz, f);
    fclose(f);
    if (r != (size_t)sz) { free(buf); return false; }
    buf[sz] = 0;
    *out = buf;
    *outLen = (size_t)sz;
    return true;
}

// Parse "HEADER-NAME: value\r\n..." blob into a JS object. Multi-response
// (e.g. redirects) keeps the *last* response's headers only.
static bool ParseHeaders(JSContext* cx, const char* hdrs, size_t len,
                         JS::MutableHandleObject out)
{
    JS::RootedObject obj(cx, JS_NewPlainObject(cx));
    if (!obj) return false;

    const char* p = hdrs;
    const char* end = hdrs + len;
    // Find the LAST "HTTP/" marker and start parsing from there.
    const char* lastStart = p;
    for (const char* q = p; q + 5 < end; ++q) {
        if (q[0] == 'H' && q[1] == 'T' && q[2] == 'T' && q[3] == 'P' && q[4] == '/')
            lastStart = q;
    }
    p = lastStart;

    // Skip the status line.
    while (p < end && *p != '\n') ++p;
    if (p < end) ++p;

    while (p < end) {
        const char* line_end = p;
        while (line_end < end && *line_end != '\r' && *line_end != '\n')
            ++line_end;
        if (line_end == p) break;   // blank line = end of headers

        const char* colon = (const char*)memchr(p, ':', (size_t)(line_end - p));
        if (colon && colon > p) {
            size_t knl = (size_t)(colon - p);
            char key[256];
            if (knl >= sizeof key) knl = sizeof key - 1;
            for (size_t i = 0; i < knl; ++i) {
                char c = p[i];
                // Lowercase for easy consumer access (matches node's pattern).
                if (c >= 'A' && c <= 'Z') c += 32;
                key[i] = c;
            }
            key[knl] = 0;
            const char* v = colon + 1;
            while (v < line_end && (*v == ' ' || *v == '\t')) ++v;
            size_t vlen = (size_t)(line_end - v);
            JS::RootedString vs(cx, JS_NewStringCopyN(cx, v, vlen));
            if (!vs) return false;
            JS::RootedValue vv(cx, JS::StringValue(vs));
            if (!JS_DefineProperty(cx, obj, key, vv, JSPROP_ENUMERATE))
                return false;
        }

        // Advance to next line.
        p = line_end;
        if (p < end && *p == '\r') ++p;
        if (p < end && *p == '\n') ++p;
    }

    out.set(obj);
    return true;
}

// Shared fetcher: runs curl and fills `rv` with { status, headers, body }.
// method: "GET" or "POST" etc.
// bodyBytes/bodyLen: null if no request body (POST requires these).
static bool DoCurl(JSContext* cx, const char* url, const char* method,
                   const uint8_t* bodyBytes, size_t bodyLen,
                   JS::HandleObject opts, JS::MutableHandleValue rv)
{
    char curlBin[PATH_MAX];
    if (!FindCurl(curlBin, sizeof curlBin)) {
        JS_ReportError(cx, "http: curl binary not found (tried "
                       "/opt/tigersh-deps-0.1/bin/curl and /usr/bin/curl)");
        return false;
    }

    // Temp paths under ${TMPDIR:-/tmp}.
    char bodyPath[PATH_MAX], hdrPath[PATH_MAX], bodyReqPath[PATH_MAX];
    const char* tmp = getenv("TMPDIR");
    if (!tmp || !*tmp) tmp = "/tmp";
    snprintf(bodyPath,     sizeof bodyPath,     "%s/ionpower-http-%d-body.tmp",   tmp, (int)getpid());
    snprintf(hdrPath,      sizeof hdrPath,      "%s/ionpower-http-%d-hdrs.tmp",   tmp, (int)getpid());
    snprintf(bodyReqPath,  sizeof bodyReqPath,  "%s/ionpower-http-%d-reqbody.tmp",tmp, (int)getpid());

    // Write request body if given.
    if (bodyBytes && bodyLen) {
        FILE* f = fopen(bodyReqPath, "wb");
        if (!f) {
            JS_ReportError(cx, "http: open request-body temp: %s", strerror(errno));
            return false;
        }
        if (fwrite(bodyBytes, 1, bodyLen, f) != bodyLen) {
            fclose(f);
            JS_ReportError(cx, "http: write request-body temp");
            return false;
        }
        fclose(f);
    }

    // Assemble the argv. We use fork/execv rather than system() to dodge
    // shell-escaping pitfalls on the URL.
    const char* ca = FindCaBundle();

    int timeoutSec = 30;
    bool insecure = false;
    if (opts) {
        JS::RootedValue v(cx);
        if (JS_GetProperty(cx, opts, "timeout", &v) && v.isNumber()) {
            timeoutSec = (int)v.toNumber();
            if (timeoutSec > 0 && timeoutSec < 3600000) {}
            else timeoutSec = 30;
        }
        if (JS_GetProperty(cx, opts, "insecure", &v) && v.isBoolean()) {
            insecure = v.toBoolean();
        }
    }

    // Build argv.
    const int kMaxArgs = 64;
    const char* argv[kMaxArgs];
    int argc = 0;
    argv[argc++] = curlBin;
    argv[argc++] = "-sS";
    argv[argc++] = "-A";
    argv[argc++] = "ionpower-node/0.1";
    argv[argc++] = "-o";
    argv[argc++] = bodyPath;
    argv[argc++] = "-D";
    argv[argc++] = hdrPath;
    argv[argc++] = "-w";
    argv[argc++] = "%{http_code}";
    argv[argc++] = "-L";
    char timeoutBuf[16];
    snprintf(timeoutBuf, sizeof timeoutBuf, "%d", timeoutSec);
    argv[argc++] = "--max-time";
    argv[argc++] = timeoutBuf;
    if (ca && !insecure) {
        argv[argc++] = "--cacert";
        argv[argc++] = ca;
    }
    if (insecure) {
        argv[argc++] = "-k";
    }
    // Method.
    if (method && strcmp(method, "GET") != 0) {
        argv[argc++] = "-X";
        argv[argc++] = method;
    }
    // Optional headers.
    JSAutoByteString headerStrings[32];
    char* joinedHeaders[32];
    size_t nHeaderStrings = 0;
    if (opts) {
        JS::RootedValue hv(cx);
        if (JS_GetProperty(cx, opts, "headers", &hv) && hv.isObject()) {
            JS::RootedObject ho(cx, &hv.toObject());
            JS::Rooted<JS::IdVector> keys(cx, JS::IdVector(cx));
            if (JS_Enumerate(cx, ho, &keys)) {
                for (size_t i = 0; i < keys.length() && nHeaderStrings < 32 && argc + 2 < kMaxArgs; ++i) {
                    JS::RootedId idR(cx, keys[i]);
                    JS::RootedValue kv(cx);
                    if (!JS_IdToValue(cx, idR, &kv)) continue;
                    JS::RootedString ks(cx, JS::ToString(cx, kv));
                    if (!ks) continue;
                    JS::RootedValue vv(cx);
                    if (!JS_GetPropertyById(cx, ho, idR, &vv)) continue;
                    JS::RootedString vs(cx, JS::ToString(cx, vv));
                    if (!vs) continue;
                    JSAutoByteString kb(cx, ks), vb(cx, vs);
                    if (!kb || !vb) continue;
                    size_t jl = strlen(kb.ptr()) + strlen(vb.ptr()) + 3;
                    char* joined = (char*)malloc(jl);
                    if (!joined) continue;
                    snprintf(joined, jl, "%s: %s", kb.ptr(), vb.ptr());
                    joinedHeaders[nHeaderStrings++] = joined;
                    argv[argc++] = "-H";
                    argv[argc++] = joined;
                }
            }
        }
    }
    if (bodyBytes && bodyLen) {
        argv[argc++] = "--data-binary";
        // curl supports @filename for file-backed bodies.
        char atFileBuf[PATH_MAX + 1];
        snprintf(atFileBuf, sizeof atFileBuf, "@%s", bodyReqPath);
        char* atFileHeap = strdup(atFileBuf);
        argv[argc++] = atFileHeap;
    }
    argv[argc++] = url;
    argv[argc] = NULL;

    // Fork + exec.
    int pipefd[2];
    if (pipe(pipefd) != 0) {
        JS_ReportError(cx, "http: pipe: %s", strerror(errno));
        return false;
    }
    pid_t pid = fork();
    if (pid < 0) {
        close(pipefd[0]); close(pipefd[1]);
        JS_ReportError(cx, "http: fork: %s", strerror(errno));
        return false;
    }
    if (pid == 0) {
        // Child.
        close(pipefd[0]);
        dup2(pipefd[1], 1);
        close(pipefd[1]);
        execv(argv[0], (char* const*)argv);
        _exit(127);
    }
    close(pipefd[1]);

    // Read the %{http_code} off stdout.
    char statusBuf[16];
    size_t sread = 0;
    for (;;) {
        ssize_t n = read(pipefd[0], statusBuf + sread, sizeof statusBuf - sread - 1);
        if (n < 0) { if (errno == EINTR) continue; break; }
        if (n == 0) break;
        sread += (size_t)n;
        if (sread + 1 >= sizeof statusBuf) break;
    }
    statusBuf[sread] = 0;
    close(pipefd[0]);

    int childStatus = 0;
    waitpid(pid, &childStatus, 0);

    // Free any header strings.
    for (size_t i = 0; i < nHeaderStrings; ++i) free(joinedHeaders[i]);

    if (!WIFEXITED(childStatus) || WEXITSTATUS(childStatus) != 0) {
        // Mop up tmp files.
        unlink(bodyPath); unlink(hdrPath);
        if (bodyBytes && bodyLen) unlink(bodyReqPath);
        JS_ReportError(cx, "http: curl exited %d (status=%s)",
                       WEXITSTATUS(childStatus), statusBuf);
        return false;
    }

    int status = atoi(statusBuf);

    // Headers.
    char* hdrBuf = NULL; size_t hdrLen = 0;
    JS::RootedObject hdrObj(cx);
    if (ReadFileToString(hdrPath, &hdrBuf, &hdrLen)) {
        if (!ParseHeaders(cx, hdrBuf, hdrLen, &hdrObj)) {
            free(hdrBuf); unlink(bodyPath); unlink(hdrPath);
            if (bodyBytes && bodyLen) unlink(bodyReqPath);
            return false;
        }
        free(hdrBuf);
    } else {
        hdrObj = JS_NewPlainObject(cx);
    }

    // Body.
    char* bodyBuf = NULL; size_t bodyLen2 = 0;
    ReadFileToString(bodyPath, &bodyBuf, &bodyLen2);

    unlink(bodyPath); unlink(hdrPath);
    if (bodyBytes && bodyLen) unlink(bodyReqPath);

    // Build the result { status, headers, body }.
    JS::RootedObject result(cx, JS_NewPlainObject(cx));
    if (!result) { if (bodyBuf) free(bodyBuf); return false; }

    JS::RootedValue statusV(cx, JS::Int32Value(status));
    if (!JS_DefineProperty(cx, result, "status", statusV, JSPROP_ENUMERATE)) {
        if (bodyBuf) free(bodyBuf); return false;
    }

    JS::RootedValue hdrV(cx, JS::ObjectValue(*hdrObj));
    if (!JS_DefineProperty(cx, result, "headers", hdrV, JSPROP_ENUMERATE)) {
        if (bodyBuf) free(bodyBuf); return false;
    }

    // Body as string (UTF-8 decoded). For binary use .bodyBytes below.
    // Bodies with non-UTF-8 bytes (gzip / images / tar) leave the
    // string side empty but the bytes path still works; clear any
    // pending JS exception that the failed decode left behind so the
    // bodyBytes Uint8Array we build next isn't tripped up by it.
    if (bodyBuf) {
        JS::UTF8Chars u8(bodyBuf, bodyLen2);
        size_t u16len = 0;
        char16_t* u16 = JS::UTF8CharsToNewTwoByteCharsZ(cx, u8, &u16len).get();
        if (u16) {
            JS::RootedString bodyStr(cx, JS_NewUCString(cx, u16, u16len));
            if (bodyStr) {
                JS::RootedValue bV(cx, JS::StringValue(bodyStr));
                JS_DefineProperty(cx, result, "body", bV, JSPROP_ENUMERATE);
            }
        } else if (JS_IsExceptionPending(cx)) {
            // UTF-8 decode failed (binary body); clear so subsequent
            // JSAPI calls aren't poisoned by the pending exception.
            JS_ClearPendingException(cx);
            // Set body to empty string so consumers get a sane value
            // if they read .body instead of .bodyBytes.
            JS::RootedString empty(cx, JS_NewStringCopyZ(cx, ""));
            JS::RootedValue eV(cx, JS::StringValue(empty));
            JS_DefineProperty(cx, result, "body", eV, JSPROP_ENUMERATE);
        }
        // Also expose raw bytes as a Uint8Array.
        JS::RootedObject arr(cx, JS_NewUint8Array(cx, bodyLen2));
        if (arr) {
            JS::AutoCheckCannotGC nogc;
            bool sharedDummy;
            uint8_t* data = JS_GetUint8ArrayData(arr, &sharedDummy, nogc);
            if (data) memcpy(data, bodyBuf, bodyLen2);
            JS::RootedValue bbV(cx, JS::ObjectValue(*arr));
            JS_DefineProperty(cx, result, "bodyBytes", bbV, JSPROP_ENUMERATE);
        }
        free(bodyBuf);
    } else {
        JS::RootedString empty(cx, JS_NewStringCopyZ(cx, ""));
        JS::RootedValue eV(cx, JS::StringValue(empty));
        JS_DefineProperty(cx, result, "body", eV, JSPROP_ENUMERATE);
    }

    rv.setObject(*result);
    return true;
}

static bool HttpGetSync(JSContext* cx, unsigned argc, JS::Value* vp) {
    JS::CallArgs args = JS::CallArgsFromVp(argc, vp);
    if (args.length() < 1) {
        JS_ReportError(cx, "http.getSync: url required");
        return false;
    }
    JS::RootedString urlS(cx, JS::ToString(cx, args[0]));
    if (!urlS) return false;
    JSAutoByteString url(cx, urlS);
    if (!url) return false;

    JS::RootedObject opts(cx);
    if (args.length() >= 2 && args[1].isObject()) opts = &args[1].toObject();

    JS::RootedValue out(cx);
    if (!DoCurl(cx, url.ptr(), "GET", NULL, 0, opts, &out)) return false;
    args.rval().set(out);
    return true;
}

static bool HttpPostSync(JSContext* cx, unsigned argc, JS::Value* vp) {
    JS::CallArgs args = JS::CallArgsFromVp(argc, vp);
    if (args.length() < 2) {
        JS_ReportError(cx, "http.postSync: url and body required");
        return false;
    }
    JS::RootedString urlS(cx, JS::ToString(cx, args[0]));
    if (!urlS) return false;
    JSAutoByteString url(cx, urlS);
    if (!url) return false;

    const uint8_t* data = NULL;
    size_t len = 0;
    JSAutoByteString strBytes;
    if (args[1].isString()) {
        JS::RootedString s(cx, args[1].toString());
        if (!strBytes.encodeUtf8(cx, s)) return false;
        data = (const uint8_t*)strBytes.ptr();
        len = strlen(strBytes.ptr());
    } else if (args[1].isObject() && JS_IsUint8Array(&args[1].toObject())) {
        JS::RootedObject u8(cx, &args[1].toObject());
        len = JS_GetTypedArrayByteLength(u8);
        JS::AutoCheckCannotGC nogc;
        bool sharedDummy;
        data = JS_GetUint8ArrayData(u8, &sharedDummy, nogc);
    } else {
        JS_ReportError(cx, "http.postSync: body must be string or Uint8Array");
        return false;
    }

    JS::RootedObject opts(cx);
    if (args.length() >= 3 && args[2].isObject()) opts = &args[2].toObject();

    JS::RootedValue out(cx);
    if (!DoCurl(cx, url.ptr(), "POST", data, len, opts, &out)) return false;
    args.rval().set(out);
    return true;
}

static const JSFunctionSpec kHttpFuncs[] = {
    JS_FN("getSync",  HttpGetSync,  1, 0),
    JS_FN("postSync", HttpPostSync, 2, 0),
    JS_FS_END
};

bool InstallHttp(JSContext* cx, JS::HandleObject global) {
    JS::RootedObject http(cx, JS_NewPlainObject(cx));
    if (!http) return false;
    if (!JS_DefineFunctions(cx, http, kHttpFuncs)) return false;
    return JS_DefineProperty(cx, global, "__http_native__", http,
                             JSPROP_PERMANENT | JSPROP_READONLY);
}

} // namespace ionpower
