// tls.cpp — native OpenSSL bindings for tls / https.
//
// Exposes `__tls_native__` on the global with:
//
//   createClientCtx(opts) -> ctxId
//     opts: { caFile?, caPem?, rejectUnauthorized? }
//   createServerCtx(opts) -> ctxId
//     opts: { certPem, keyPem }
//   freeCtx(ctxId)
//
//   createConn(ctxId, isServer) -> connId
//     Allocates SSL + BIO pair. We own the network-side BIO.
//   freeConn(connId)
//
//   setServername(connId, host)
//                                      // SNI on the client side; void on server.
//   handshake(connId) -> 'connected' | 'want_read' | 'want_write' | 'error'
//   shutdown(connId)  -> 'done' | 'want_read' | 'want_write'
//
//   bioWrite(connId, encBytes) -> int   // push encrypted bytes from network
//   bioRead(connId, max)       -> Uint8Array  // pull encrypted bytes to send
//   bioPending(connId)         -> int   // bytes sitting in network-side BIO
//
//   sslWrite(connId, plainBytes) -> int   // push app bytes; encrypted via BIO
//   sslRead(connId, max)         -> { bytes: Uint8Array|null,
//                                      eof: bool, wantRead: bool, error?: string }
//
//   getPeerCert(connId)   -> { subject, issuer, valid_from, valid_to } | null
//   getCipher(connId)     -> string
//   getProtocol(connId)   -> string
//   getError(connId)      -> string                  // last OpenSSL error (or '')
//   versionText()         -> string                  // OPENSSL_VERSION_TEXT
//
// Design: We use an OpenSSL BIO pair so that the JS side fully drives
// I/O via the existing event loop. SSL talks to its "internal" BIO; we
// push/pull encrypted bytes via the "network" BIO. This decouples TLS
// machinery from any specific socket type — the JS layer wraps a
// net.Socket and pumps bytes both ways.
//
// Lifetime: ctxId / connId are opaque integers. We hold the actual
// pointers in static std::map. Forgetting to free is a leak but
// shouldn't crash. The JS shim guarantees freeConn on socket destroy.
//
// Errors: most functions return a sentinel string for non-fatal states
// ('want_read'/'want_write'/'eof') and report fatal OpenSSL errors via
// JS_ReportError. The JS layer catches and emits 'error' on the
// TLSSocket.

#include "node_compat/globals.h"

#include <errno.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <map>
#include <string>

#include <openssl/bio.h>
#include <openssl/err.h>
#include <openssl/pem.h>
#include <openssl/ssl.h>
#include <openssl/x509.h>
#include <openssl/x509v3.h>
#include <openssl/opensslv.h>

#include "jsapi.h"
#include "jsfriendapi.h"
#include "js/Conversions.h"

namespace ionpower {

// Forward decl for the encoding helper sitting in net.cpp / child_process.cpp.
// (Each of those files defines its own static; we need our own tiny one.)
static bool TlsEncodeStrUtf8(JSContext* cx, JSString* raw, JSAutoByteString* out) {
    JS::RootedString s(cx, raw);
    return out->encodeUtf8(cx, s) != nullptr;
}

// --- one-time init -------------------------------------------------

static bool g_inited = false;
static void EnsureInit() {
    if (g_inited) return;
    g_inited = true;
    // OpenSSL 1.1.0+ self-initializes; these calls are harmless.
    SSL_load_error_strings();
    OpenSSL_add_ssl_algorithms();
}

// --- handle tables -------------------------------------------------

struct TlsConn {
    SSL_CTX* ctx;        // borrowed
    SSL* ssl;            // owned
    BIO* netBio;         // owned (network-side end of the BIO pair)
    bool isServer;
    bool handshakeDone;
};

static std::map<int, SSL_CTX*> g_ctxs;
static std::map<int, TlsConn*> g_conns;
static int g_nextCtxId = 1;
static int g_nextConnId = 1;

// --- helper: drain OpenSSL error queue into a string ---------------

static std::string DrainErrors() {
    std::string out;
    unsigned long e;
    char buf[256];
    while ((e = ERR_get_error()) != 0) {
        ERR_error_string_n(e, buf, sizeof(buf));
        if (!out.empty()) out += "; ";
        out += buf;
    }
    return out;
}

// --- helper: get a Uint8Array from a JS value ----------------------

static bool ExtractUint8(JSContext* cx, JS::HandleValue v,
                         std::string* outCopy) {
    if (!v.isObject()) {
        JS_ReportError(cx, "expected Uint8Array");
        return false;
    }
    JS::RootedObject obj(cx, &v.toObject());
    if (!JS_IsUint8Array(obj)) {
        JS_ReportError(cx, "expected Uint8Array");
        return false;
    }
    uint32_t len = JS_GetTypedArrayByteLength(obj);
    JS::AutoCheckCannotGC nogc;
    bool shared;
    uint8_t* src = JS_GetUint8ArrayData(obj, &shared, nogc);
    if (!src && len > 0) {
        JS_ReportError(cx, "Uint8Array data unavailable");
        return false;
    }
    outCopy->assign(reinterpret_cast<const char*>(src), len);
    return true;
}

// --- ctx creation --------------------------------------------------

static bool JsCreateClientCtx(JSContext* cx, unsigned argc, JS::Value* vp) {
    JS::CallArgs args = JS::CallArgsFromVp(argc, vp);
    EnsureInit();
    SSL_CTX* ctx = SSL_CTX_new(TLS_client_method());
    if (!ctx) {
        JS_ReportError(cx, "SSL_CTX_new (client) failed: %s", DrainErrors().c_str());
        return false;
    }
    // Modern defaults: TLS 1.2+
    SSL_CTX_set_min_proto_version(ctx, TLS1_2_VERSION);
    SSL_CTX_set_options(ctx, SSL_OP_NO_COMPRESSION);

    // Defaults to peer verify on. opts.rejectUnauthorized=false to disable.
    bool rejectUnauthorized = true;
    std::string caFile, caPem;

    if (args.length() >= 1 && args[0].isObject()) {
        JS::RootedObject opts(cx, &args[0].toObject());

        JS::RootedValue ru(cx);
        if (JS_GetProperty(cx, opts, "rejectUnauthorized", &ru) && ru.isBoolean())
            rejectUnauthorized = ru.toBoolean();

        JS::RootedValue cf(cx);
        if (JS_GetProperty(cx, opts, "caFile", &cf) && cf.isString()) {
            JSAutoByteString bs;
            if (!TlsEncodeStrUtf8(cx, cf.toString(), &bs)) { SSL_CTX_free(ctx); return false; }
            caFile = bs.ptr();
        }
        JS::RootedValue cp(cx);
        if (JS_GetProperty(cx, opts, "caPem", &cp) && cp.isString()) {
            JSAutoByteString bs;
            if (!TlsEncodeStrUtf8(cx, cp.toString(), &bs)) { SSL_CTX_free(ctx); return false; }
            caPem = bs.ptr();
        }
    }

    // CA loading: explicit caFile > caPem > defaults.
    if (!caFile.empty()) {
        if (!SSL_CTX_load_verify_locations(ctx, caFile.c_str(), nullptr)) {
            std::string e = DrainErrors();
            SSL_CTX_free(ctx);
            JS_ReportError(cx, "load CA file %s: %s", caFile.c_str(), e.c_str());
            return false;
        }
    } else if (!caPem.empty()) {
        BIO* mem = BIO_new_mem_buf(caPem.data(), (int)caPem.size());
        if (!mem) { SSL_CTX_free(ctx); JS_ReportError(cx, "BIO_new_mem_buf"); return false; }
        X509_STORE* store = SSL_CTX_get_cert_store(ctx);
        for (;;) {
            X509* x = PEM_read_bio_X509(mem, nullptr, nullptr, nullptr);
            if (!x) break;
            X509_STORE_add_cert(store, x);
            X509_free(x);
        }
        ERR_clear_error();  // may have ended with a benign EOF error
        BIO_free(mem);
    } else {
        // Default search: standard openssl dirs + the project's bundled bundle.
        SSL_CTX_set_default_verify_paths(ctx);
        const char* candidates[] = {
            "/opt/ca-certificates-20230110/share/cacert.pem",
            "/usr/local/etc/openssl@1.1/cert.pem",
            "/etc/ssl/cert.pem",
            nullptr
        };
        for (int i = 0; candidates[i]; ++i) {
            FILE* f = fopen(candidates[i], "rb");
            if (f) {
                fclose(f);
                SSL_CTX_load_verify_locations(ctx, candidates[i], nullptr);
                break;
            }
        }
    }

    SSL_CTX_set_verify(ctx, rejectUnauthorized ? SSL_VERIFY_PEER : SSL_VERIFY_NONE,
                       nullptr);

    int id = g_nextCtxId++;
    g_ctxs[id] = ctx;
    args.rval().setInt32(id);
    return true;
}

static bool JsCreateServerCtx(JSContext* cx, unsigned argc, JS::Value* vp) {
    JS::CallArgs args = JS::CallArgsFromVp(argc, vp);
    EnsureInit();
    if (args.length() < 1 || !args[0].isObject()) {
        JS_ReportError(cx, "createServerCtx: opts required");
        return false;
    }
    JS::RootedObject opts(cx, &args[0].toObject());

    std::string certPem, keyPem;

    JS::RootedValue cv(cx);
    if (!JS_GetProperty(cx, opts, "certPem", &cv) || !cv.isString()) {
        JS_ReportError(cx, "createServerCtx: certPem required");
        return false;
    }
    {
        JSAutoByteString bs;
        if (!TlsEncodeStrUtf8(cx, cv.toString(), &bs)) return false;
        certPem = bs.ptr();
    }

    JS::RootedValue kv(cx);
    if (!JS_GetProperty(cx, opts, "keyPem", &kv) || !kv.isString()) {
        JS_ReportError(cx, "createServerCtx: keyPem required");
        return false;
    }
    {
        JSAutoByteString bs;
        if (!TlsEncodeStrUtf8(cx, kv.toString(), &bs)) return false;
        keyPem = bs.ptr();
    }

    SSL_CTX* ctx = SSL_CTX_new(TLS_server_method());
    if (!ctx) {
        JS_ReportError(cx, "SSL_CTX_new (server) failed: %s", DrainErrors().c_str());
        return false;
    }
    SSL_CTX_set_min_proto_version(ctx, TLS1_2_VERSION);
    SSL_CTX_set_options(ctx, SSL_OP_NO_COMPRESSION);
    // Disable session resumption tickets — keeps things simple on a slow box.
    SSL_CTX_set_options(ctx, SSL_OP_NO_TICKET);

    // Load cert chain (cert may be a single cert or a full chain in one PEM).
    BIO* certBio = BIO_new_mem_buf(certPem.data(), (int)certPem.size());
    if (!certBio) { SSL_CTX_free(ctx); JS_ReportError(cx, "BIO_new_mem_buf cert"); return false; }
    X509* leaf = PEM_read_bio_X509(certBio, nullptr, nullptr, nullptr);
    if (!leaf) {
        std::string e = DrainErrors();
        BIO_free(certBio); SSL_CTX_free(ctx);
        JS_ReportError(cx, "parse certPem: %s", e.c_str());
        return false;
    }
    if (SSL_CTX_use_certificate(ctx, leaf) != 1) {
        std::string e = DrainErrors();
        X509_free(leaf); BIO_free(certBio); SSL_CTX_free(ctx);
        JS_ReportError(cx, "use cert: %s", e.c_str());
        return false;
    }
    X509_free(leaf);
    // Append any further certs in the PEM as the chain.
    for (;;) {
        X509* x = PEM_read_bio_X509(certBio, nullptr, nullptr, nullptr);
        if (!x) break;
        SSL_CTX_add_extra_chain_cert(ctx, x);  // takes ownership
    }
    ERR_clear_error();
    BIO_free(certBio);

    // Load private key.
    BIO* keyBio = BIO_new_mem_buf(keyPem.data(), (int)keyPem.size());
    if (!keyBio) { SSL_CTX_free(ctx); JS_ReportError(cx, "BIO_new_mem_buf key"); return false; }
    EVP_PKEY* pkey = PEM_read_bio_PrivateKey(keyBio, nullptr, nullptr, nullptr);
    if (!pkey) {
        std::string e = DrainErrors();
        BIO_free(keyBio); SSL_CTX_free(ctx);
        JS_ReportError(cx, "parse keyPem: %s", e.c_str());
        return false;
    }
    if (SSL_CTX_use_PrivateKey(ctx, pkey) != 1) {
        std::string e = DrainErrors();
        EVP_PKEY_free(pkey); BIO_free(keyBio); SSL_CTX_free(ctx);
        JS_ReportError(cx, "use key: %s", e.c_str());
        return false;
    }
    EVP_PKEY_free(pkey);
    BIO_free(keyBio);
    if (SSL_CTX_check_private_key(ctx) != 1) {
        std::string e = DrainErrors();
        SSL_CTX_free(ctx);
        JS_ReportError(cx, "key/cert mismatch: %s", e.c_str());
        return false;
    }

    int id = g_nextCtxId++;
    g_ctxs[id] = ctx;
    args.rval().setInt32(id);
    return true;
}

static bool JsFreeCtx(JSContext* cx, unsigned argc, JS::Value* vp) {
    JS::CallArgs args = JS::CallArgsFromVp(argc, vp);
    int32_t id = 0;
    if (args.length() >= 1 && JS::ToInt32(cx, args[0], &id)) {
        std::map<int, SSL_CTX*>::iterator it = g_ctxs.find(id);
        if (it != g_ctxs.end()) {
            SSL_CTX_free(it->second);
            g_ctxs.erase(it);
        }
    }
    args.rval().setUndefined();
    return true;
}

// --- conn creation -------------------------------------------------

static bool JsCreateConn(JSContext* cx, unsigned argc, JS::Value* vp) {
    JS::CallArgs args = JS::CallArgsFromVp(argc, vp);
    if (args.length() < 1) { JS_ReportError(cx, "createConn: ctxId"); return false; }
    int32_t ctxId = 0;
    if (!JS::ToInt32(cx, args[0], &ctxId)) return false;
    bool isServer = args.length() >= 2 && JS::ToBoolean(args[1]);

    std::map<int, SSL_CTX*>::iterator it = g_ctxs.find(ctxId);
    if (it == g_ctxs.end()) { JS_ReportError(cx, "createConn: bad ctxId %d", ctxId); return false; }
    SSL_CTX* ctx = it->second;

    SSL* ssl = SSL_new(ctx);
    if (!ssl) {
        JS_ReportError(cx, "SSL_new: %s", DrainErrors().c_str());
        return false;
    }
    BIO* internal = nullptr;
    BIO* netBio = nullptr;
    if (BIO_new_bio_pair(&internal, 32 * 1024, &netBio, 32 * 1024) != 1) {
        std::string e = DrainErrors();
        SSL_free(ssl);
        JS_ReportError(cx, "BIO_new_bio_pair: %s", e.c_str());
        return false;
    }
    SSL_set_bio(ssl, internal, internal);  // SSL takes ownership of internal

    if (isServer) SSL_set_accept_state(ssl);
    else          SSL_set_connect_state(ssl);

    TlsConn* conn = new TlsConn();
    conn->ctx = ctx;
    conn->ssl = ssl;
    conn->netBio = netBio;
    conn->isServer = isServer;
    conn->handshakeDone = false;

    int id = g_nextConnId++;
    g_conns[id] = conn;
    args.rval().setInt32(id);
    return true;
}

static bool JsFreeConn(JSContext* cx, unsigned argc, JS::Value* vp) {
    JS::CallArgs args = JS::CallArgsFromVp(argc, vp);
    int32_t id = 0;
    if (args.length() >= 1 && JS::ToInt32(cx, args[0], &id)) {
        std::map<int, TlsConn*>::iterator it = g_conns.find(id);
        if (it != g_conns.end()) {
            TlsConn* c = it->second;
            if (c->ssl) SSL_free(c->ssl);  // also frees its internal BIO
            if (c->netBio) BIO_free(c->netBio);
            delete c;
            g_conns.erase(it);
        }
    }
    args.rval().setUndefined();
    return true;
}

// --- helpers -------------------------------------------------------

static TlsConn* GetConn(JSContext* cx, JS::HandleValue v) {
    int32_t id = 0;
    if (!JS::ToInt32(cx, v, &id)) return nullptr;
    std::map<int, TlsConn*>::iterator it = g_conns.find(id);
    if (it == g_conns.end()) {
        JS_ReportError(cx, "tls conn not found: %d", id);
        return nullptr;
    }
    return it->second;
}

// --- SNI -----------------------------------------------------------

static bool JsSetServername(JSContext* cx, unsigned argc, JS::Value* vp) {
    JS::CallArgs args = JS::CallArgsFromVp(argc, vp);
    if (args.length() < 2) { JS_ReportError(cx, "setServername: connId, host"); return false; }
    TlsConn* c = GetConn(cx, args[0]);
    if (!c) return false;
    if (!args[1].isString()) { JS_ReportError(cx, "setServername: host must be string"); return false; }
    JSAutoByteString bs;
    if (!TlsEncodeStrUtf8(cx, args[1].toString(), &bs)) return false;
    if (!c->isServer) {
        SSL_set_tlsext_host_name(c->ssl, bs.ptr());
        // Also set hostname for cert verification (if rejectUnauthorized).
        X509_VERIFY_PARAM* param = SSL_get0_param(c->ssl);
        X509_VERIFY_PARAM_set_hostflags(param, X509_CHECK_FLAG_NO_PARTIAL_WILDCARDS);
        X509_VERIFY_PARAM_set1_host(param, bs.ptr(), 0);
    }
    args.rval().setUndefined();
    return true;
}

// --- handshake -----------------------------------------------------

static bool JsHandshake(JSContext* cx, unsigned argc, JS::Value* vp) {
    JS::CallArgs args = JS::CallArgsFromVp(argc, vp);
    if (args.length() < 1) { JS_ReportError(cx, "handshake: connId"); return false; }
    TlsConn* c = GetConn(cx, args[0]);
    if (!c) return false;

    int r = SSL_do_handshake(c->ssl);
    const char* state;
    if (r == 1) {
        c->handshakeDone = true;
        state = "connected";
    } else {
        int err = SSL_get_error(c->ssl, r);
        if (err == SSL_ERROR_WANT_READ)  state = "want_read";
        else if (err == SSL_ERROR_WANT_WRITE) state = "want_write";
        else {
            std::string e = DrainErrors();
            // Surface verify-failure separately for nicer JS error messages.
            long vr = SSL_get_verify_result(c->ssl);
            if (vr != X509_V_OK) {
                JS_ReportError(cx, "TLS handshake failed: %s (verify: %s)",
                               e.empty() ? "unknown" : e.c_str(),
                               X509_verify_cert_error_string(vr));
            } else {
                JS_ReportError(cx, "TLS handshake failed: %s",
                               e.empty() ? "unknown" : e.c_str());
            }
            return false;
        }
    }
    JS::RootedString s(cx, JS_NewStringCopyZ(cx, state));
    if (!s) return false;
    args.rval().setString(s);
    return true;
}

// --- BIO bridge ----------------------------------------------------

// bioWrite(connId, encBytes) — pushes encrypted bytes into the network
// BIO so SSL machinery sees them as "incoming from peer". Returns the
// number of bytes consumed (may be less than provided if BIO is full).
static bool JsBioWrite(JSContext* cx, unsigned argc, JS::Value* vp) {
    JS::CallArgs args = JS::CallArgsFromVp(argc, vp);
    if (args.length() < 2) { JS_ReportError(cx, "bioWrite: connId, data"); return false; }
    TlsConn* c = GetConn(cx, args[0]);
    if (!c) return false;
    std::string data;
    if (!ExtractUint8(cx, args[1], &data)) return false;
    if (data.empty()) { args.rval().setInt32(0); return true; }
    int n = BIO_write(c->netBio, data.data(), (int)data.size());
    if (n <= 0) {
        if (BIO_should_retry(c->netBio)) { args.rval().setInt32(0); return true; }
        JS_ReportError(cx, "BIO_write: %s", DrainErrors().c_str());
        return false;
    }
    args.rval().setInt32(n);
    return true;
}

// bioRead(connId, max) — pulls encrypted bytes from the network BIO
// (these are bytes SSL wants to send out to the peer). Returns a
// Uint8Array, possibly empty.
static bool JsBioRead(JSContext* cx, unsigned argc, JS::Value* vp) {
    JS::CallArgs args = JS::CallArgsFromVp(argc, vp);
    if (args.length() < 1) { JS_ReportError(cx, "bioRead: connId"); return false; }
    TlsConn* c = GetConn(cx, args[0]);
    if (!c) return false;
    int32_t max = 16384;
    if (args.length() >= 2 && !JS::ToInt32(cx, args[1], &max)) return false;
    if (max <= 0 || max > (1 << 20)) max = 16384;

    std::string buf; buf.resize(max);
    int n = BIO_read(c->netBio, &buf[0], max);
    if (n <= 0) {
        if (BIO_should_retry(c->netBio)) n = 0;
        else n = 0;
    }
    JS::RootedObject u8(cx, JS_NewUint8Array(cx, (uint32_t)n));
    if (!u8) return false;
    if (n > 0) {
        JS::AutoCheckCannotGC nogc;
        bool shared;
        uint8_t* dst = JS_GetUint8ArrayData(u8, &shared, nogc);
        if (!dst) { JS_ReportError(cx, "bioRead: alloc"); return false; }
        memcpy(dst, buf.data(), (size_t)n);
    }
    args.rval().setObject(*u8);
    return true;
}

static bool JsBioPending(JSContext* cx, unsigned argc, JS::Value* vp) {
    JS::CallArgs args = JS::CallArgsFromVp(argc, vp);
    if (args.length() < 1) { JS_ReportError(cx, "bioPending: connId"); return false; }
    TlsConn* c = GetConn(cx, args[0]);
    if (!c) return false;
    args.rval().setInt32((int32_t)BIO_pending(c->netBio));
    return true;
}

// --- SSL read/write ------------------------------------------------

static bool JsSslWrite(JSContext* cx, unsigned argc, JS::Value* vp) {
    JS::CallArgs args = JS::CallArgsFromVp(argc, vp);
    if (args.length() < 2) { JS_ReportError(cx, "sslWrite: connId, data"); return false; }
    TlsConn* c = GetConn(cx, args[0]);
    if (!c) return false;
    std::string data;
    if (!ExtractUint8(cx, args[1], &data)) return false;
    if (data.empty()) { args.rval().setInt32(0); return true; }
    int n = SSL_write(c->ssl, data.data(), (int)data.size());
    if (n <= 0) {
        int err = SSL_get_error(c->ssl, n);
        if (err == SSL_ERROR_WANT_READ || err == SSL_ERROR_WANT_WRITE) {
            args.rval().setInt32(0); return true;
        }
        JS_ReportError(cx, "SSL_write: %s", DrainErrors().c_str());
        return false;
    }
    args.rval().setInt32(n);
    return true;
}

// sslRead(connId, max) -> { bytes:Uint8Array(may be 0-length), eof:bool, wantRead:bool }
static bool JsSslRead(JSContext* cx, unsigned argc, JS::Value* vp) {
    JS::CallArgs args = JS::CallArgsFromVp(argc, vp);
    if (args.length() < 1) { JS_ReportError(cx, "sslRead: connId"); return false; }
    TlsConn* c = GetConn(cx, args[0]);
    if (!c) return false;
    int32_t max = 16384;
    if (args.length() >= 2 && !JS::ToInt32(cx, args[1], &max)) return false;
    if (max <= 0 || max > (1 << 20)) max = 16384;

    std::string buf; buf.resize(max);
    int n = SSL_read(c->ssl, &buf[0], max);

    JS::RootedObject out(cx, JS_NewPlainObject(cx));
    if (!out) return false;
    bool eof = false, wantRead = false;
    int gotN = 0;
    if (n > 0) {
        gotN = n;
    } else {
        int err = SSL_get_error(c->ssl, n);
        if (err == SSL_ERROR_WANT_READ || err == SSL_ERROR_WANT_WRITE) {
            wantRead = true;
        } else if (err == SSL_ERROR_ZERO_RETURN) {
            eof = true;
        } else if (err == SSL_ERROR_SYSCALL && n == 0) {
            // Peer closed without close_notify — treat as eof.
            eof = true;
        } else {
            std::string e = DrainErrors();
            JS_ReportError(cx, "SSL_read: %s", e.empty() ? "unknown" : e.c_str());
            return false;
        }
    }
    JS::RootedObject u8(cx, JS_NewUint8Array(cx, (uint32_t)gotN));
    if (!u8) return false;
    if (gotN > 0) {
        JS::AutoCheckCannotGC nogc;
        bool shared;
        uint8_t* dst = JS_GetUint8ArrayData(u8, &shared, nogc);
        if (!dst) { JS_ReportError(cx, "sslRead: alloc"); return false; }
        memcpy(dst, buf.data(), (size_t)gotN);
    }
    JS::RootedValue v(cx);
    v.setObject(*u8);    JS_DefineProperty(cx, out, "bytes",    v, JSPROP_ENUMERATE);
    v.setBoolean(eof);   JS_DefineProperty(cx, out, "eof",      v, JSPROP_ENUMERATE);
    v.setBoolean(wantRead); JS_DefineProperty(cx, out, "wantRead", v, JSPROP_ENUMERATE);
    args.rval().setObject(*out);
    return true;
}

// --- shutdown ------------------------------------------------------

static bool JsShutdownConn(JSContext* cx, unsigned argc, JS::Value* vp) {
    JS::CallArgs args = JS::CallArgsFromVp(argc, vp);
    if (args.length() < 1) { JS_ReportError(cx, "shutdownConn: connId"); return false; }
    TlsConn* c = GetConn(cx, args[0]);
    if (!c) return false;
    int r = SSL_shutdown(c->ssl);
    const char* state;
    if (r >= 1) state = "done";
    else if (r == 0) state = "want_read";   // we sent close_notify; peer hasn't yet
    else {
        int err = SSL_get_error(c->ssl, r);
        if (err == SSL_ERROR_WANT_READ)  state = "want_read";
        else if (err == SSL_ERROR_WANT_WRITE) state = "want_write";
        else state = "done";  // best-effort: don't error on shutdown
    }
    JS::RootedString s(cx, JS_NewStringCopyZ(cx, state));
    if (!s) return false;
    args.rval().setString(s);
    return true;
}

// --- introspection -------------------------------------------------

static JSString* MakeAsn1String(JSContext* cx, const ASN1_STRING* s) {
    if (!s) return JS_NewStringCopyZ(cx, "");
    unsigned char* utf8 = nullptr;
    int len = ASN1_STRING_to_UTF8(&utf8, const_cast<ASN1_STRING*>(s));
    if (len < 0 || !utf8) return JS_NewStringCopyZ(cx, "");
    JSString* out = JS_NewStringCopyN(cx, reinterpret_cast<const char*>(utf8), len);
    OPENSSL_free(utf8);
    return out;
}

static JSString* MakeX509NameString(JSContext* cx, X509_NAME* name) {
    if (!name) return JS_NewStringCopyZ(cx, "");
    char* dn = X509_NAME_oneline(name, nullptr, 0);
    if (!dn) return JS_NewStringCopyZ(cx, "");
    JSString* s = JS_NewStringCopyZ(cx, dn);
    OPENSSL_free(dn);
    return s;
}

static JSString* MakeAsn1TimeString(JSContext* cx, const ASN1_TIME* t) {
    if (!t) return JS_NewStringCopyZ(cx, "");
    BIO* b = BIO_new(BIO_s_mem());
    if (!b) return JS_NewStringCopyZ(cx, "");
    ASN1_TIME_print(b, t);
    char* data = nullptr;
    long n = BIO_get_mem_data(b, &data);
    JSString* s = (n > 0 && data)
        ? JS_NewStringCopyN(cx, data, (size_t)n)
        : JS_NewStringCopyZ(cx, "");
    BIO_free(b);
    return s;
}

static bool JsGetPeerCert(JSContext* cx, unsigned argc, JS::Value* vp) {
    JS::CallArgs args = JS::CallArgsFromVp(argc, vp);
    if (args.length() < 1) { JS_ReportError(cx, "getPeerCert: connId"); return false; }
    TlsConn* c = GetConn(cx, args[0]);
    if (!c) return false;
    X509* peer = SSL_get_peer_certificate(c->ssl);
    if (!peer) { args.rval().setNull(); return true; }

    JS::RootedObject o(cx, JS_NewPlainObject(cx));
    if (!o) { X509_free(peer); return false; }

    JS::RootedString sub(cx, MakeX509NameString(cx, X509_get_subject_name(peer)));
    JS::RootedValue subv(cx, JS::StringValue(sub));
    JS_DefineProperty(cx, o, "subject", subv, JSPROP_ENUMERATE);

    JS::RootedString iss(cx, MakeX509NameString(cx, X509_get_issuer_name(peer)));
    JS::RootedValue issv(cx, JS::StringValue(iss));
    JS_DefineProperty(cx, o, "issuer", issv, JSPROP_ENUMERATE);

    JS::RootedString vfrom(cx, MakeAsn1TimeString(cx, X509_get0_notBefore(peer)));
    JS::RootedValue vfv(cx, JS::StringValue(vfrom));
    JS_DefineProperty(cx, o, "valid_from", vfv, JSPROP_ENUMERATE);

    JS::RootedString vto(cx, MakeAsn1TimeString(cx, X509_get0_notAfter(peer)));
    JS::RootedValue vtv(cx, JS::StringValue(vto));
    JS_DefineProperty(cx, o, "valid_to", vtv, JSPROP_ENUMERATE);

    X509_free(peer);
    args.rval().setObject(*o);
    return true;
}

static bool JsGetCipher(JSContext* cx, unsigned argc, JS::Value* vp) {
    JS::CallArgs args = JS::CallArgsFromVp(argc, vp);
    if (args.length() < 1) { JS_ReportError(cx, "getCipher: connId"); return false; }
    TlsConn* c = GetConn(cx, args[0]);
    if (!c) return false;
    const char* name = SSL_get_cipher(c->ssl);
    JS::RootedString s(cx, JS_NewStringCopyZ(cx, name ? name : ""));
    if (!s) return false;
    args.rval().setString(s);
    return true;
}

static bool JsGetProtocol(JSContext* cx, unsigned argc, JS::Value* vp) {
    JS::CallArgs args = JS::CallArgsFromVp(argc, vp);
    if (args.length() < 1) { JS_ReportError(cx, "getProtocol: connId"); return false; }
    TlsConn* c = GetConn(cx, args[0]);
    if (!c) return false;
    const char* name = SSL_get_version(c->ssl);
    JS::RootedString s(cx, JS_NewStringCopyZ(cx, name ? name : ""));
    if (!s) return false;
    args.rval().setString(s);
    return true;
}

static bool JsVersionText(JSContext* cx, unsigned argc, JS::Value* vp) {
    JS::CallArgs args = JS::CallArgsFromVp(argc, vp);
    JS::RootedString s(cx, JS_NewStringCopyZ(cx, OPENSSL_VERSION_TEXT));
    if (!s) return false;
    args.rval().setString(s);
    return true;
}

// --- self-signed cert helper for demos / tests ---------------------
// Generates an RSA-2048 keypair + self-signed cert valid for `days`.
// Returns { keyPem, certPem }. Slow on a G3 — about 8-15 seconds.
static bool JsGenerateSelfSigned(JSContext* cx, unsigned argc, JS::Value* vp) {
    JS::CallArgs args = JS::CallArgsFromVp(argc, vp);
    EnsureInit();

    std::string commonName = "localhost";
    int days = 365;
    if (args.length() >= 1 && args[0].isString()) {
        JSAutoByteString bs;
        if (!TlsEncodeStrUtf8(cx, args[0].toString(), &bs)) return false;
        commonName = bs.ptr();
    }
    if (args.length() >= 2) {
        int32_t d = days;
        if (JS::ToInt32(cx, args[1], &d)) days = d;
    }

    EVP_PKEY* pkey = EVP_PKEY_new();
    if (!pkey) { JS_ReportError(cx, "EVP_PKEY_new"); return false; }

    BIGNUM* bne = BN_new();
    BN_set_word(bne, RSA_F4);
    RSA* rsa = RSA_new();
    if (!RSA_generate_key_ex(rsa, 2048, bne, nullptr)) {
        std::string e = DrainErrors();
        BN_free(bne); RSA_free(rsa); EVP_PKEY_free(pkey);
        JS_ReportError(cx, "RSA_generate_key_ex: %s", e.c_str());
        return false;
    }
    BN_free(bne);
    EVP_PKEY_assign_RSA(pkey, rsa);  // pkey owns rsa now

    X509* x = X509_new();
    if (!x) { EVP_PKEY_free(pkey); JS_ReportError(cx, "X509_new"); return false; }
    ASN1_INTEGER_set(X509_get_serialNumber(x), 1);
    X509_gmtime_adj(X509_getm_notBefore(x), 0);
    X509_gmtime_adj(X509_getm_notAfter(x), 60L * 60L * 24L * days);
    X509_set_pubkey(x, pkey);
    X509_NAME* name = X509_get_subject_name(x);
    X509_NAME_add_entry_by_txt(name, "CN", MBSTRING_ASC,
                               (const unsigned char*)commonName.c_str(), -1, -1, 0);
    X509_set_issuer_name(x, name);
    if (!X509_sign(x, pkey, EVP_sha256())) {
        std::string e = DrainErrors();
        X509_free(x); EVP_PKEY_free(pkey);
        JS_ReportError(cx, "X509_sign: %s", e.c_str());
        return false;
    }

    // PEM-encode key + cert.
    BIO* keyBio = BIO_new(BIO_s_mem());
    PEM_write_bio_PrivateKey(keyBio, pkey, nullptr, nullptr, 0, nullptr, nullptr);
    char* keyData = nullptr;
    long keyLen = BIO_get_mem_data(keyBio, &keyData);
    JS::RootedString keyS(cx, JS_NewStringCopyN(cx, keyData, (size_t)keyLen));
    BIO_free(keyBio);

    BIO* certBio = BIO_new(BIO_s_mem());
    PEM_write_bio_X509(certBio, x);
    char* certData = nullptr;
    long certLen = BIO_get_mem_data(certBio, &certData);
    JS::RootedString certS(cx, JS_NewStringCopyN(cx, certData, (size_t)certLen));
    BIO_free(certBio);

    X509_free(x);
    EVP_PKEY_free(pkey);

    JS::RootedObject out(cx, JS_NewPlainObject(cx));
    if (!out || !keyS || !certS) return false;
    JS::RootedValue v(cx);
    v.setString(keyS);  JS_DefineProperty(cx, out, "keyPem",  v, JSPROP_ENUMERATE);
    v.setString(certS); JS_DefineProperty(cx, out, "certPem", v, JSPROP_ENUMERATE);
    args.rval().setObject(*out);
    return true;
}

// --- install -------------------------------------------------------

bool InstallTls(JSContext* cx, JS::HandleObject global) {
    JS::RootedObject n(cx, JS_NewPlainObject(cx));
    if (!n) return false;

#define DEF(name, fn, nargs) \
    if (!JS_DefineFunction(cx, n, name, fn, nargs, JSPROP_ENUMERATE)) return false

    DEF("createClientCtx",     JsCreateClientCtx,    1);
    DEF("createServerCtx",     JsCreateServerCtx,    1);
    DEF("freeCtx",             JsFreeCtx,            1);
    DEF("createConn",          JsCreateConn,         2);
    DEF("freeConn",            JsFreeConn,           1);
    DEF("setServername",       JsSetServername,      2);
    DEF("handshake",           JsHandshake,          1);
    DEF("bioWrite",            JsBioWrite,           2);
    DEF("bioRead",             JsBioRead,            2);
    DEF("bioPending",          JsBioPending,         1);
    DEF("sslWrite",            JsSslWrite,           2);
    DEF("sslRead",             JsSslRead,            2);
    DEF("shutdownConn",        JsShutdownConn,       1);
    DEF("getPeerCert",         JsGetPeerCert,        1);
    DEF("getCipher",           JsGetCipher,          1);
    DEF("getProtocol",         JsGetProtocol,        1);
    DEF("versionText",         JsVersionText,        0);
    DEF("generateSelfSigned",  JsGenerateSelfSigned, 2);

#undef DEF

    return JS_DefineProperty(cx, global, "__tls_native__", n, JSPROP_ENUMERATE);
}

} // namespace ionpower
