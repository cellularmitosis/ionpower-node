// net.cpp — native primitives for BSD sockets (non-blocking).
//
// Exposes `__net_native__` on global with:
//   socketCreate(family, type, proto) -> fd
//   bind(fd, host, port)              // returns {port} on success; throws on fail
//   listen(fd, backlog)
//   accept(fd)                        // returns {fd, host, port} or null on wouldBlock
//   connect(fd, host, port)           // returns true if connected, false if pending
//   setNonBlocking(fd)
//   setsockopt(fd, level, name, int32) // wraps a few common options
//   getsockname(fd) -> {host, port}
//   getpeername(fd) -> {host, port}
//   getError(fd) -> int32             // SO_ERROR; 0 = ok
//   shutdown(fd, how)                 // 0=read, 1=write, 2=both
//   close(fd)                         // same as child_process.closeFd
//
// All blocking where the kernel would block; the event loop's ioWatch
// primitive handles the async side. DNS resolution uses gethostbyname
// (blocking) for simplicity — fine on a retro machine where "remote"
// is usually a numeric IP or an NSS-cached hostname.

#include "node_compat/globals.h"

#include <arpa/inet.h>
#include <errno.h>
#include <fcntl.h>
#include <netdb.h>
#include <netinet/in.h>
#include <netinet/tcp.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/socket.h>
#include <sys/types.h>
#include <sys/un.h>
#include <unistd.h>
#include <string>

#include "jsapi.h"
#include "jsfriendapi.h"
#include "js/Conversions.h"

namespace ionpower {

// EncodeJSStringUtf8 is defined in child_process.cpp — declare it here.
static bool EncodeStrUtf8(JSContext* cx, JSString* raw, JSAutoByteString* out) {
    JS::RootedString s(cx, raw);
    return out->encodeUtf8(cx, s) != nullptr;
}

// Resolve "1.2.3.4" or "hostname" into a sockaddr_in. Returns true on
// success. "0.0.0.0" and "::" variants map as expected.
static bool ResolveHost(const char* host, uint16_t port, struct sockaddr_in* out) {
    memset(out, 0, sizeof(*out));
    out->sin_family = AF_INET;
    out->sin_port = htons(port);
    if (!host || !*host) {
        out->sin_addr.s_addr = htonl(INADDR_ANY);
        return true;
    }
    // Numeric IP fast path.
    if (inet_aton(host, &out->sin_addr)) return true;
    // Fall back to blocking gethostbyname. (getaddrinfo would be nicer
    // but gethostbyname is the Tiger-era workhorse and works for v4.)
    struct hostent* he = gethostbyname(host);
    if (!he || he->h_addrtype != AF_INET || !he->h_addr_list[0]) return false;
    memcpy(&out->sin_addr, he->h_addr_list[0], sizeof(out->sin_addr));
    return true;
}

static JSObject* MakeHostPortObject(JSContext* cx, const struct sockaddr_in* sa) {
    JS::RootedObject o(cx, JS_NewPlainObject(cx));
    if (!o) return nullptr;
    char ip[INET_ADDRSTRLEN];
    inet_ntop(AF_INET, &sa->sin_addr, ip, sizeof(ip));
    JS::RootedString s(cx, JS_NewStringCopyZ(cx, ip));
    JS::RootedValue sv(cx, JS::StringValue(s));
    if (!JS_DefineProperty(cx, o, "host", sv, JSPROP_ENUMERATE)) return nullptr;
    JS::RootedValue pv(cx, JS::Int32Value((int32_t)ntohs(sa->sin_port)));
    if (!JS_DefineProperty(cx, o, "port", pv, JSPROP_ENUMERATE)) return nullptr;
    JS::RootedString fam(cx, JS_NewStringCopyZ(cx, "IPv4"));
    JS::RootedValue fv(cx, JS::StringValue(fam));
    if (!JS_DefineProperty(cx, o, "family", fv, JSPROP_ENUMERATE)) return nullptr;
    return o;
}

// ---- JS-exposed functions ------------------------------------------

// socketCreate(family=2 AF_INET, type=1 SOCK_STREAM, proto=0) -> fd
static bool JsSocketCreate(JSContext* cx, unsigned argc, JS::Value* vp) {
    JS::CallArgs args = JS::CallArgsFromVp(argc, vp);
    int family = AF_INET, type = SOCK_STREAM, proto = 0;
    if (args.length() >= 1) { int32_t v; if (!JS::ToInt32(cx, args[0], &v)) return false; family = v; }
    if (args.length() >= 2) { int32_t v; if (!JS::ToInt32(cx, args[1], &v)) return false; type = v; }
    if (args.length() >= 3) { int32_t v; if (!JS::ToInt32(cx, args[2], &v)) return false; proto = v; }
    int fd = socket(family, type, proto);
    if (fd < 0) {
        JS_ReportError(cx, "socket: %s", strerror(errno));
        return false;
    }
    // Always non-blocking for the event loop path.
    int fl = fcntl(fd, F_GETFL, 0);
    fcntl(fd, F_SETFL, fl | O_NONBLOCK);
    // Enable SO_REUSEADDR so Server.listen after a crash picks up the port.
    int one = 1;
    setsockopt(fd, SOL_SOCKET, SO_REUSEADDR, &one, sizeof(one));
    args.rval().setInt32(fd);
    return true;
}

// bind(fd, host, port) -> {host, port}
static bool JsBind(JSContext* cx, unsigned argc, JS::Value* vp) {
    JS::CallArgs args = JS::CallArgsFromVp(argc, vp);
    if (args.length() < 3) { JS_ReportError(cx, "bind: 3 args"); return false; }
    int32_t fd = 0, port = 0;
    if (!JS::ToInt32(cx, args[0], &fd)) return false;
    JSAutoByteString hostBs;
    if (!args[1].isString() || !EncodeStrUtf8(cx, args[1].toString(), &hostBs)) {
        JS_ReportError(cx, "bind: host must be string");
        return false;
    }
    if (!JS::ToInt32(cx, args[2], &port)) return false;
    struct sockaddr_in sa;
    if (!ResolveHost(hostBs.ptr(), (uint16_t)port, &sa)) {
        JS_ReportError(cx, "bind: cannot resolve %s", hostBs.ptr());
        return false;
    }
    if (::bind(fd, (struct sockaddr*)&sa, sizeof(sa)) < 0) {
        JS_ReportError(cx, "bind: %s", strerror(errno));
        return false;
    }
    struct sockaddr_in named;
    socklen_t namedLen = sizeof(named);
    if (getsockname(fd, (struct sockaddr*)&named, &namedLen) < 0) named = sa;
    JS::RootedObject ro(cx, MakeHostPortObject(cx, &named));
    if (!ro) return false;
    args.rval().setObject(*ro);
    return true;
}

// listen(fd, backlog)
static bool JsListen(JSContext* cx, unsigned argc, JS::Value* vp) {
    JS::CallArgs args = JS::CallArgsFromVp(argc, vp);
    if (args.length() < 1) { JS_ReportError(cx, "listen: fd required"); return false; }
    int32_t fd = 0, backlog = 128;
    if (!JS::ToInt32(cx, args[0], &fd)) return false;
    if (args.length() >= 2) JS::ToInt32(cx, args[1], &backlog);
    if (::listen(fd, backlog) < 0) {
        JS_ReportError(cx, "listen: %s", strerror(errno));
        return false;
    }
    args.rval().setUndefined();
    return true;
}

// accept(fd) -> {fd, host, port} or null on wouldBlock
static bool JsAccept(JSContext* cx, unsigned argc, JS::Value* vp) {
    JS::CallArgs args = JS::CallArgsFromVp(argc, vp);
    int32_t fd = 0;
    if (args.length() < 1 || !JS::ToInt32(cx, args[0], &fd)) { JS_ReportError(cx, "accept: fd required"); return false; }
    struct sockaddr_in peer;
    socklen_t plen = sizeof(peer);
    int c = accept(fd, (struct sockaddr*)&peer, &plen);
    if (c < 0) {
        if (errno == EAGAIN || errno == EWOULDBLOCK) {
            args.rval().setNull();
            return true;
        }
        JS_ReportError(cx, "accept: %s", strerror(errno));
        return false;
    }
    int fl = fcntl(c, F_GETFL, 0);
    fcntl(c, F_SETFL, fl | O_NONBLOCK);
    JS::RootedObject o(cx, MakeHostPortObject(cx, &peer));
    if (!o) return false;
    JS::RootedValue fv(cx, JS::Int32Value(c));
    if (!JS_DefineProperty(cx, o, "fd", fv, JSPROP_ENUMERATE)) return false;
    args.rval().setObject(*o);
    return true;
}

// connect(fd, host, port) -> {done: bool, wouldBlock: bool, errno?}
static bool JsConnect(JSContext* cx, unsigned argc, JS::Value* vp) {
    JS::CallArgs args = JS::CallArgsFromVp(argc, vp);
    if (args.length() < 3) { JS_ReportError(cx, "connect: 3 args"); return false; }
    int32_t fd = 0, port = 0;
    if (!JS::ToInt32(cx, args[0], &fd)) return false;
    JSAutoByteString hostBs;
    if (!args[1].isString() || !EncodeStrUtf8(cx, args[1].toString(), &hostBs)) {
        JS_ReportError(cx, "connect: host must be string");
        return false;
    }
    if (!JS::ToInt32(cx, args[2], &port)) return false;
    struct sockaddr_in sa;
    if (!ResolveHost(hostBs.ptr(), (uint16_t)port, &sa)) {
        JS_ReportError(cx, "connect: cannot resolve %s", hostBs.ptr());
        return false;
    }
    int r = ::connect(fd, (struct sockaddr*)&sa, sizeof(sa));
    int saved_errno = errno;
    JS::RootedObject out(cx, JS_NewPlainObject(cx));
    if (!out) return false;
    JS::RootedValue v(cx);
    if (r == 0) {
        v.setBoolean(true);  JS_DefineProperty(cx, out, "done",       v, JSPROP_ENUMERATE);
        v.setBoolean(false); JS_DefineProperty(cx, out, "wouldBlock", v, JSPROP_ENUMERATE);
    } else if (saved_errno == EINPROGRESS || saved_errno == EWOULDBLOCK ||
               saved_errno == EALREADY) {
        v.setBoolean(false); JS_DefineProperty(cx, out, "done",       v, JSPROP_ENUMERATE);
        v.setBoolean(true);  JS_DefineProperty(cx, out, "wouldBlock", v, JSPROP_ENUMERATE);
    } else {
        v.setBoolean(false); JS_DefineProperty(cx, out, "done",       v, JSPROP_ENUMERATE);
        v.setBoolean(false); JS_DefineProperty(cx, out, "wouldBlock", v, JSPROP_ENUMERATE);
        v.setInt32(saved_errno); JS_DefineProperty(cx, out, "errno",    v, JSPROP_ENUMERATE);
    }
    args.rval().setObject(*out);
    return true;
}

// getError(fd) -> int32 (SO_ERROR — 0 = connected ok)
static bool JsGetError(JSContext* cx, unsigned argc, JS::Value* vp) {
    JS::CallArgs args = JS::CallArgsFromVp(argc, vp);
    int32_t fd = 0;
    if (args.length() < 1 || !JS::ToInt32(cx, args[0], &fd)) { JS_ReportError(cx, "getError: fd"); return false; }
    int err = 0;
    socklen_t len = sizeof(err);
    if (getsockopt(fd, SOL_SOCKET, SO_ERROR, &err, &len) < 0) err = errno;
    args.rval().setInt32(err);
    return true;
}

static bool JsGetsockname(JSContext* cx, unsigned argc, JS::Value* vp) {
    JS::CallArgs args = JS::CallArgsFromVp(argc, vp);
    int32_t fd = 0;
    if (args.length() < 1 || !JS::ToInt32(cx, args[0], &fd)) { JS_ReportError(cx, "getsockname: fd"); return false; }
    struct sockaddr_in sa;
    socklen_t sl = sizeof(sa);
    if (getsockname(fd, (struct sockaddr*)&sa, &sl) < 0) {
        JS_ReportError(cx, "getsockname: %s", strerror(errno));
        return false;
    }
    JS::RootedObject o(cx, MakeHostPortObject(cx, &sa));
    if (!o) return false;
    args.rval().setObject(*o);
    return true;
}

static bool JsGetpeername(JSContext* cx, unsigned argc, JS::Value* vp) {
    JS::CallArgs args = JS::CallArgsFromVp(argc, vp);
    int32_t fd = 0;
    if (args.length() < 1 || !JS::ToInt32(cx, args[0], &fd)) { JS_ReportError(cx, "getpeername: fd"); return false; }
    struct sockaddr_in sa;
    socklen_t sl = sizeof(sa);
    if (getpeername(fd, (struct sockaddr*)&sa, &sl) < 0) {
        JS_ReportError(cx, "getpeername: %s", strerror(errno));
        return false;
    }
    JS::RootedObject o(cx, MakeHostPortObject(cx, &sa));
    if (!o) return false;
    args.rval().setObject(*o);
    return true;
}

static bool JsShutdown(JSContext* cx, unsigned argc, JS::Value* vp) {
    JS::CallArgs args = JS::CallArgsFromVp(argc, vp);
    int32_t fd = 0, how = SHUT_WR;
    if (args.length() < 1 || !JS::ToInt32(cx, args[0], &fd)) { JS_ReportError(cx, "shutdown: fd"); return false; }
    if (args.length() >= 2) JS::ToInt32(cx, args[1], &how);
    shutdown(fd, how);
    args.rval().setUndefined();
    return true;
}

static bool JsClose(JSContext* cx, unsigned argc, JS::Value* vp) {
    JS::CallArgs args = JS::CallArgsFromVp(argc, vp);
    int32_t fd = 0;
    if (args.length() >= 1 && JS::ToInt32(cx, args[0], &fd)) close(fd);
    args.rval().setUndefined();
    return true;
}

// lookup(host) -> {address, family} — synchronous gethostbyname wrapper.
static bool JsLookup(JSContext* cx, unsigned argc, JS::Value* vp) {
    JS::CallArgs args = JS::CallArgsFromVp(argc, vp);
    if (args.length() < 1 || !args[0].isString()) {
        JS_ReportError(cx, "lookup: hostname string required");
        return false;
    }
    JSAutoByteString hostBs;
    if (!EncodeStrUtf8(cx, args[0].toString(), &hostBs)) return false;
    struct sockaddr_in sa;
    if (!ResolveHost(hostBs.ptr(), 0, &sa)) {
        JS_ReportError(cx, "lookup: cannot resolve %s", hostBs.ptr());
        return false;
    }
    char ip[INET_ADDRSTRLEN];
    inet_ntop(AF_INET, &sa.sin_addr, ip, sizeof(ip));
    JS::RootedObject o(cx, JS_NewPlainObject(cx));
    if (!o) return false;
    JS::RootedString s(cx, JS_NewStringCopyZ(cx, ip));
    JS::RootedValue sv(cx, JS::StringValue(s));
    if (!JS_DefineProperty(cx, o, "address", sv, JSPROP_ENUMERATE)) return false;
    JS::RootedValue fv(cx, JS::Int32Value(4));
    if (!JS_DefineProperty(cx, o, "family", fv, JSPROP_ENUMERATE)) return false;
    args.rval().setObject(*o);
    return true;
}

// setNoDelay(fd, bool)
static bool JsSetNoDelay(JSContext* cx, unsigned argc, JS::Value* vp) {
    JS::CallArgs args = JS::CallArgsFromVp(argc, vp);
    int32_t fd = 0;
    bool on = true;
    if (args.length() >= 1 && !JS::ToInt32(cx, args[0], &fd)) return false;
    if (args.length() >= 2) on = JS::ToBoolean(args[1]);
    int flag = on ? 1 : 0;
    setsockopt(fd, IPPROTO_TCP, TCP_NODELAY, &flag, sizeof(flag));
    args.rval().setUndefined();
    return true;
}

bool InstallNet(JSContext* cx, JS::HandleObject global) {
    JS::RootedObject n(cx, JS_NewPlainObject(cx));
    if (!n) return false;
    if (!JS_DefineFunction(cx, n, "socketCreate",   JsSocketCreate,  3, JSPROP_ENUMERATE)) return false;
    if (!JS_DefineFunction(cx, n, "bind",           JsBind,          3, JSPROP_ENUMERATE)) return false;
    if (!JS_DefineFunction(cx, n, "listen",         JsListen,        2, JSPROP_ENUMERATE)) return false;
    if (!JS_DefineFunction(cx, n, "accept",         JsAccept,        1, JSPROP_ENUMERATE)) return false;
    if (!JS_DefineFunction(cx, n, "connect",        JsConnect,       3, JSPROP_ENUMERATE)) return false;
    if (!JS_DefineFunction(cx, n, "getError",       JsGetError,      1, JSPROP_ENUMERATE)) return false;
    if (!JS_DefineFunction(cx, n, "getsockname",    JsGetsockname,   1, JSPROP_ENUMERATE)) return false;
    if (!JS_DefineFunction(cx, n, "getpeername",    JsGetpeername,   1, JSPROP_ENUMERATE)) return false;
    if (!JS_DefineFunction(cx, n, "shutdown",       JsShutdown,      2, JSPROP_ENUMERATE)) return false;
    if (!JS_DefineFunction(cx, n, "closeFd",        JsClose,         1, JSPROP_ENUMERATE)) return false;
    if (!JS_DefineFunction(cx, n, "setNoDelay",     JsSetNoDelay,    2, JSPROP_ENUMERATE)) return false;
    if (!JS_DefineFunction(cx, n, "lookup",         JsLookup,        1, JSPROP_ENUMERATE)) return false;

    // Constants
    JS::RootedValue v(cx);
    v.setInt32(AF_INET);      JS_DefineProperty(cx, n, "AF_INET",     v, JSPROP_ENUMERATE);
    v.setInt32(SOCK_STREAM);  JS_DefineProperty(cx, n, "SOCK_STREAM", v, JSPROP_ENUMERATE);
    v.setInt32(SOCK_DGRAM);   JS_DefineProperty(cx, n, "SOCK_DGRAM",  v, JSPROP_ENUMERATE);
    v.setInt32(SHUT_RD);      JS_DefineProperty(cx, n, "SHUT_RD",     v, JSPROP_ENUMERATE);
    v.setInt32(SHUT_WR);      JS_DefineProperty(cx, n, "SHUT_WR",     v, JSPROP_ENUMERATE);
    v.setInt32(SHUT_RDWR);    JS_DefineProperty(cx, n, "SHUT_RDWR",   v, JSPROP_ENUMERATE);

    return JS_DefineProperty(cx, global, "__net_native__", n, JSPROP_ENUMERATE);
}

} // namespace ionpower
