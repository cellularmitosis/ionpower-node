# demos/https — TLS-secured HTTP server + client

A minimal showcase of the `tls` and `https` modules added in v0.83.

- **`server.js`** — HTTPS server with a self-signed cert generated at
  startup. Three routes: `/`, `/info`, `/echo?msg=`.
- **`client.js`** — CLI HTTPS client. Fetches a URL, prints headers,
  TLS metadata (protocol, cipher, peer cert), and the response body.
  Defaults to talking to the local server but accepts any HTTPS URL.

## Run

In one terminal:

```bash
./node demos/https/server.js
# generating self-signed RSA-2048 cert (slow on G3 ~6 s)...
# cert generated in 5837 ms
# listening on https://0.0.0.0:8443/
```

In a second terminal:

```bash
# Hit the local server (auto-skips cert validation since it's self-signed):
./node demos/https/client.js
# < HTTP/1.1 200 OK
# < content-type: application/json
# ...
# ---- TLS info ----
#   protocol: TLSv1.3
#   cipher:   TLS_AES_256_GCM_SHA384
#   peer cert subject: /CN=ionpower-https-demo
#   ...

# Or any public HTTPS URL:
./node demos/https/client.js https://example.com/
./node demos/https/client.js https://httpbin.org/ip

# Pass -k to skip cert validation against a non-localhost host:
./node demos/https/client.js -k https://self-signed.badssl.com/
```

In a browser, open `https://<host>:8443/`. Accept the self-signed cert
warning to see a small status page with TLS details.

## What this demonstrates

The `tls` and `https` modules in ionpower-node are real — they link
against OpenSSL 1.1.1t and use the same TLS state machine that
production Node uses. From your code's perspective:

```javascript
var https = require('https');
https.get('https://example.com/', function (res) {
    res.on('data', ...);  // decrypted bytes
    res.on('end',  ...);
});
```

The client demo also reaches into `socket.getProtocol()`,
`socket.getCipher()`, and `socket.getPeerCertificate()` — all
implemented on top of OpenSSL's `SSL_get_version`, `SSL_get_cipher`,
and `SSL_get_peer_certificate`.

The server demo uses `tls.generateSelfSigned(commonName, days)`, an
ionpower-node helper that wraps OpenSSL's keygen + X.509 signing for
no-fuss demos. For real deployments you'd point `cert` and `key` at
PEM files (or paths to PEM files) on disk:

```javascript
https.createServer({
    cert: fs.readFileSync('/etc/letsencrypt/live/example.com/fullchain.pem'),
    key:  fs.readFileSync('/etc/letsencrypt/live/example.com/privkey.pem')
}, handler).listen(443);
```

## Notes

- The server uses a fresh self-signed cert on every restart. Browsers
  will keep warning unless you click through.
- TLS 1.2 and TLS 1.3 are both supported; 1.3 is preferred by default.
- The HTTPS request and response framing (chunked / Content-Length /
  keep-alive) reuses the existing `http` parser. Only the socket type
  is different.
- See [`BUILDING.md`](../../BUILDING.md) for the OpenSSL prerequisite.
