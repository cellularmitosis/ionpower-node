# Makefile for ionpower-node. Runs on the target host (imacg52 or another
# Tiger PPC fleet host). Assumes SpiderMonkey has been built and installed
# at $(MOZJS_PREFIX) (see scripts/build-mozjs.sh).

MOZJS_PREFIX ?= /opt/mozjs-45-ionpower
# OpenSSL prefix for tls / https. Installed via tiger.sh or by manually
# unpacking leopard.sh/binpkgs/openssl-1.1.1t.tiger.<arch>.tar.gz under /opt.
OPENSSL_PREFIX ?= /opt/openssl-1.1.1t
# Use := so make's built-in default (CXX=g++) doesn't shadow this.
CXX          := /opt/gcc-4.9.4/bin/g++-4.9
CC           := /opt/gcc-4.9.4/bin/gcc-4.9

# CPU tuning: default to the G5 flags for backward compatibility. Override
# on the command line for the other fleet hosts:
#   make MOZJS_PREFIX=/opt/mozjs-45-ionpower-g3 CPU_FLAGS='-mcpu=750 -mtune=750'
#   make MOZJS_PREFIX=/opt/mozjs-45-ionpower-g4 CPU_FLAGS='-mcpu=7450 -mtune=7450'
CPU_FLAGS ?= -mcpu=G5 -D_PPC970_

MACOSX_SDK ?= /Developer/SDKs/MacOSX10.4u.sdk
CXXFLAGS = -m32 -mmacosx-version-min=10.4 -isysroot $(MACOSX_SDK) $(CPU_FLAGS) -force_cpusubtype_ALL \
           -std=gnu++0x -fpermissive -fno-exceptions -fno-rtti \
           -O2 -g \
           -I src -I $(MOZJS_PREFIX)/include/mozjs-45 -I $(OPENSSL_PREFIX)/include

# emac (and any Xcode-less host) has no /usr/bin/ld that groks modern
# mach-o coalesced-section relocs in the mozjs static archive. If the
# tigerbrew-era ld64 is installed at /opt/ld64-97.17-tigerbrew/, point
# gcc's collect2 at it via -B. Auto-detected below.
LD_SEARCH := $(shell test -x /opt/ld64-97.17-tigerbrew/bin/ld && \
                     echo -B /opt/ld64-97.17-tigerbrew/bin/)

LDFLAGS  = -L $(MOZJS_PREFIX)/lib -L $(OPENSSL_PREFIX)/lib \
           -m32 -mmacosx-version-min=10.4 \
           -isysroot $(MACOSX_SDK) \
           -force_cpusubtype_ALL $(LD_SEARCH)
# Mozilla's install renames libjs_static.a to lib${JS_LIBRARY_NAME}.a
# (= libmozjs-45.a), but some standalone configurations skip the rename.
# Fall through to -ljs_static if -lmozjs-45 isn't found.
MOZJS_LIB := $(shell \
    if test -e $(MOZJS_PREFIX)/lib/libmozjs-45.a; then echo -lmozjs-45; \
    elif test -e $(MOZJS_PREFIX)/lib/libjs_static.a; then echo -ljs_static; \
    else echo -lmozjs-45; fi)
# js-config reports "-lm" as the required trailing libs for mozjs-45's
# standalone (posix-wrapper NSPR embedded into libjs_static).
# Static-link OpenSSL so the binary doesn't depend on @rpath/libssl at run
# time. The .a archives at $(OPENSSL_PREFIX)/lib are picked up before any
# .dylib via -l (Apple ld defaults to dylib-first, so reach the static
# archives by absolute path).
OPENSSL_LIBS := $(OPENSSL_PREFIX)/lib/libssl.a $(OPENSSL_PREFIX)/lib/libcrypto.a
LDLIBS   = $(MOZJS_LIB) -lmozglue -lpthread -lm -lz \
           $(OPENSSL_LIBS) \
           -framework Carbon -framework ExceptionHandling -lobjc \
           -Wl,-stack_size,0x10000000

SRCS = src/main.cpp \
       src/node_compat/console.cpp \
       src/node_compat/process.cpp \
       src/node_compat/fs.cpp \
       src/node_compat/path.cpp \
       src/node_compat/buffer.cpp \
       src/node_compat/require.cpp \
       src/node_compat/timers.cpp \
       src/node_compat/crypto.cpp \
       src/node_compat/http.cpp \
       src/node_compat/child_process.cpp \
       src/node_compat/event_loop.cpp \
       src/node_compat/net.cpp \
       src/node_compat/tls.cpp \
       src/node_compat/zlib.cpp \
       src/node_compat/globals.cpp

OBJS = $(SRCS:.cpp=.o)

# Binary is named `node` so that scripts with `#!/usr/bin/env node`
# just work. The project is still called ionpower-node; only the
# on-disk executable is named node.
BIN = node

all: $(BIN)

$(BIN): $(OBJS)
	$(CXX) $(CXXFLAGS) $(OBJS) -o $@ $(LDFLAGS) $(LDLIBS)
	@# libmozglue.dylib on the per-CPU mozjs builds was linked with an
	@# install_name of @executable_path/libmozglue.dylib, which only
	@# works if the dylib lives next to our $(BIN). Rewrite to an
	@# absolute path so the binary runs from any cwd. No-op on G5
	@# (already absolute).
	@if otool -L $(BIN) 2>/dev/null | grep -q '@executable_path/libmozglue.dylib'; then \
	    echo "  [install_name_tool] @executable_path -> $(MOZJS_PREFIX)/lib"; \
	    install_name_tool -change @executable_path/libmozglue.dylib \
	        $(MOZJS_PREFIX)/lib/libmozglue.dylib $(BIN); \
	fi

%.o: %.cpp
	$(CXX) $(CXXFLAGS) -c -o $@ $<

clean:
	rm -f $(OBJS) $(BIN)

# Install to $(PREFIX) (default /opt/ionpower-node-$(VERSION)).
# Ships the `node` binary + babel.js fallback + README. Runtime still
# depends on /opt/mozjs-45-ionpower* being present separately.
VERSION ?= 0.88
PREFIX  ?= /opt/ionpower-node-$(VERSION)
# test/vendor/ entries the demos require at runtime. Demos use
# `__dirname/../../test/vendor/...` for their imports, so we recreate
# that relative layout under share/ionpower-node/test/vendor/. Keep
# this list in sync with what the demos actually require.
#
# Two groups:
#   1. Direct imports from demos/*/*.js
#   2. Shim targets — express's bundled node_modules/<x>/index.js
#      shims walk up to test/vendor/<x>.js, so we must ship those too.
DEMO_VENDOR_FILES = \
    ansi-styles.js     chalk.js           color-hash.js     commander.js \
    handlebars.js      hash-sum.js        js-yaml.js        kleur.js \
    markdown-it.js     pretty-ms.js       prism.js          slugify.js \
    sort-keys.js       split2.js          string-width.js   strip-ansi.js \
    text-table.js      xmldoc.js \
    bytes.js           content-type.js    cookie-signature.js cookie.js \
    destroy.js         encodeurl.js       escape-html.js    etag.js \
    finalhandler.js    forwarded.js       fresh.js          ipaddr.js \
    merge-descriptors.js  methods.js      on-finished.js    parseurl.js \
    qs-v6.js           range-parser.js    safe-buffer.js    safer-buffer.js \
    statuses.js        toidentifier.js    unpipe.js         utils-merge.js \
    vary.js \
    \
    ee-first.js        parse-ms.js        is-plain-obj.js \
    emoji-regex.js     is-fullwidth-code-point.js \
    ansi-regex.js      sax.js
# JSON sidecars some standalone vendor .js files require directly:
#   statuses.js  -> codes.json    (express → http-errors → statuses)
#   mime-types.js -> mime-db.json (anything serving static files)
#   cli-boxes.js -> cli-boxes.json
#   cli-spinners.js -> spinners.json
#   (mime-db-v2.json shipped alongside in case a demo grabs the legacy v2)
# Express's bundled node_modules/ has its own JSON files that get copied
# recursively as part of test/vendor/express, so those are already covered.
DEMO_VENDOR_JSON = \
    cli-boxes.json     codes.json         mime-db.json      mime-db-v2.json \
    spinners.json
DEMO_VENDOR_DIRS = express
DEMO_VENDOR_NM_DIRS = xml2js xmlbuilder sax

install: $(BIN)
	mkdir -p $(PREFIX)/bin $(PREFIX)/share/ionpower-node/vendor
	cp $(BIN) $(PREFIX)/bin/ionpower-node
	ln -sf ionpower-node $(PREFIX)/bin/node
	cp test/vendor/babel.js      $(PREFIX)/share/ionpower-node/vendor/
	cp test/vendor/tweetnacl.js  $(PREFIX)/share/ionpower-node/vendor/
	cp -r test/vendor/node-forge $(PREFIX)/share/ionpower-node/vendor/
	cp -r test/vendor/elliptic   $(PREFIX)/share/ionpower-node/vendor/
	cp README.md LICENSE   $(PREFIX)/share/ionpower-node/ 2>/dev/null || true
	@# --- Demos --------------------------------------------------------
	@# Ship the demos/ tree plus the closure of test/vendor/* entries
	@# they require, preserving the demos' "../../test/vendor/..."
	@# relative-import layout. ~2.5 MB extra vs runtime-only install.
	cp -r demos $(PREFIX)/share/ionpower-node/demos
	mkdir -p $(PREFIX)/share/ionpower-node/test/vendor/nm/node_modules
	@for f in $(DEMO_VENDOR_FILES); do \
	    cp test/vendor/$$f $(PREFIX)/share/ionpower-node/test/vendor/; \
	done
	@for f in $(DEMO_VENDOR_JSON); do \
	    cp test/vendor/$$f $(PREFIX)/share/ionpower-node/test/vendor/; \
	done
	@for d in $(DEMO_VENDOR_DIRS); do \
	    cp -r test/vendor/$$d $(PREFIX)/share/ionpower-node/test/vendor/; \
	done
	@for d in $(DEMO_VENDOR_NM_DIRS); do \
	    cp -r test/vendor/nm/node_modules/$$d \
	          $(PREFIX)/share/ionpower-node/test/vendor/nm/node_modules/; \
	done
	@echo
	@echo "installed ionpower-node $(VERSION) to $(PREFIX)"
	@echo "  binary:   $(PREFIX)/bin/node (-> ionpower-node)"
	@echo "  babel:    $(PREFIX)/share/ionpower-node/vendor/babel.js"
	@echo "  demos:    $(PREFIX)/share/ionpower-node/demos/"
	@echo "  mozjs:    expected at $(MOZJS_PREFIX)/"
	@echo
	@echo "Run:  $(PREFIX)/bin/node <script.js>"

# Verify the mozjs install is where we expect before attempting a build.
check-mozjs:
	@test -e $(MOZJS_PREFIX)/include/mozjs-45/jsapi.h || \
	  (echo "FAIL: jsapi.h not found at $(MOZJS_PREFIX)/include/mozjs-45/" && exit 1)
	@test -e $(MOZJS_PREFIX)/lib/libmozjs-45.a || \
	  test -e $(MOZJS_PREFIX)/lib/libjs_static.a || \
	  (echo "FAIL: no libmozjs-45.a or libjs_static.a at $(MOZJS_PREFIX)/lib/" && exit 1)
	@echo "ok: $(MOZJS_PREFIX) looks usable"

test: $(BIN)
	./scripts/smoke-test-runner.sh ./scripts/test-list-core.txt

test-libs: $(BIN)
	./scripts/smoke-test-runner.sh ./scripts/test-list-more.txt

test-all: test test-libs

# Audit: check that every test/*.js is either wired into a
# scripts/test-list-*.txt or on the intentional-skip allowlist.
# Triad-build runs this before doing any expensive remote work.
check-coverage:
	./scripts/check-test-coverage.sh

# Audit: walk demos/**/*.js + their transitive test/vendor/ deps and
# verify every reached file is shipped by the install rule. Caught
# the codes.json + ee-first.js gaps that bit us during v0.85.
check-demo-deps:
	./scripts/check-demo-deps.sh

# Emit the four DEMO_VENDOR_* lists in a stable shape for
# scripts/check-demo-deps.sh — keeps the Makefile as the source of
# truth instead of re-parsing it from bash.
print-demo-deps:
	@echo "FILES:  $(DEMO_VENDOR_FILES)"
	@echo "JSON:   $(DEMO_VENDOR_JSON)"
	@echo "DIRS:   $(DEMO_VENDOR_DIRS)"
	@echo "NMDIRS: $(DEMO_VENDOR_NM_DIRS)"

.PHONY: all clean check-mozjs check-coverage check-demo-deps print-demo-deps test test-libs test-all
