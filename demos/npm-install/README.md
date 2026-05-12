# ionpower-node npm-install — real `npm install` on a 1999 G3

Run real npm-6.14.18 under ionpower-node and watch it install an npm
package end-to-end on a 1999 PowerPC iBook G3 (Mac OS X 10.4 Tiger).

Unlike [`demos/npm-fetch/`](../npm-fetch/) (which hand-rolls fetch +
gunzip + ustar parse + write), this demo runs **real npm** with its
full pipeline: pacote / cacache / minizlib / tar / lockfile /
pump.io / npm-lifecycle / etc. Every layer of the npm 6 install
machinery is exercised under our runtime.

```
$ ssh ibookg37 './node demos/npm-install/run.js'
+ mri@1.2.0
added 1 package from 1 contributor in 2.978s
```

`mri` is dependency-free and tiny (~4 KB tarball, 6 files), so the
demo runs in a few seconds even on a 900 MHz G3.

## What this proves

The PowerPC G3 pre-dates Node.js by a decade (Node first shipped
2009; the iBook G3 shipped 1999). Yet here we run the real npm 6 CLI
under our SpiderMonkey 45 + IonPower runtime, and every layer that
npm depends on — TLS to public registries (with Cloudflare's modern
AEAD ciphers), gunzip via tiny-inflate, ustar tar parsing, atomic
lockfile creation, the cacache content-addressable store, the pump
stream destroyer, the EventEmitter `newListener` meta-event — works.

This demo uses a local tarball fixture
([`fixtures/mri-1.2.0.tgz`](fixtures/mri-1.2.0.tgz)) rather than
fetching from the registry so it works on hosts without network
access (and avoids registry rate-limiting during repeated demos).
Registry-based installs (`npm install <package-name>`) also work as
of v0.91 — see the v0.91 release notes for the TLS-to-Cloudflare
fix that unblocked them.

## How it works

1. `run.js` shells out to npm-6.14.18 (vendored at
   `/Users/macuser/tmp/npm-6.14.18`) with `install <tarball>`.
2. npm extracts the tarball via pacote → cacache → tar.
3. The result lands in `node_modules/mri/` of the demo's `tmp/`
   working dir.
4. `run.js` then `require()`s `mri` from that node_modules path and
   parses a tiny argv to prove the install produced a working package.

## Run it

```bash
ssh ibookg37 'cd /Users/macuser/tmp/ionpower-node && ./node demos/npm-install/run.js'
```

The demo cleans up its tmp/ working dir on each run, so it's
idempotent.

## Vendored fixture

`fixtures/mri-1.2.0.tgz` is the published `mri@1.2.0` tarball from
the public npm registry, vendored for offline + repeatable
demonstration. Source:
<https://registry.npmjs.org/mri/-/mri-1.2.0.tgz>.
