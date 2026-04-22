# Makefile for ionpower-node. Runs on the target host (imacg52 or another
# Tiger PPC fleet host). Assumes SpiderMonkey has been built and installed
# at $(MOZJS_PREFIX) (see scripts/build-mozjs.sh).

MOZJS_PREFIX ?= /opt/mozjs-45-ionpower
# Use := so make's built-in default (CXX=g++) doesn't shadow this.
CXX          := /opt/gcc-4.9.4/bin/g++-4.9
CC           := /opt/gcc-4.9.4/bin/gcc-4.9

CXXFLAGS = -m32 -mmacosx-version-min=10.4 -mcpu=G5 -D_PPC970_ \
           -std=gnu++0x -fpermissive -fno-exceptions -fno-rtti \
           -O2 -g \
           -I src -I $(MOZJS_PREFIX)/include/mozjs-45

LDFLAGS  = -L $(MOZJS_PREFIX)/lib -m32 -mmacosx-version-min=10.4
# Mozilla's install renames libjs_static.a to lib${JS_LIBRARY_NAME}.a
# (= libmozjs-45.a), but some standalone configurations skip the rename.
# Fall through to -ljs_static if -lmozjs-45 isn't found.
MOZJS_LIB := $(shell \
    if test -e $(MOZJS_PREFIX)/lib/libmozjs-45.a; then echo -lmozjs-45; \
    elif test -e $(MOZJS_PREFIX)/lib/libjs_static.a; then echo -ljs_static; \
    else echo -lmozjs-45; fi)
# js-config reports "-lm" as the required trailing libs for mozjs-45's
# standalone (posix-wrapper NSPR embedded into libjs_static).
LDLIBS   = $(MOZJS_LIB) -lmozglue -lpthread -lm -lz \
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
       src/node_compat/globals.cpp

OBJS = $(SRCS:.cpp=.o)

# Binary is named `node` so that scripts with `#!/usr/bin/env node`
# just work. The project is still called ionpower-node; only the
# on-disk executable is named node.
BIN = node

all: $(BIN)

$(BIN): $(OBJS)
	$(CXX) $(CXXFLAGS) $(OBJS) -o $@ $(LDFLAGS) $(LDLIBS)

%.o: %.cpp
	$(CXX) $(CXXFLAGS) -c -o $@ $<

clean:
	rm -f $(OBJS) $(BIN)

# Verify the mozjs install is where we expect before attempting a build.
check-mozjs:
	@test -e $(MOZJS_PREFIX)/include/mozjs-45/jsapi.h || \
	  (echo "FAIL: jsapi.h not found at $(MOZJS_PREFIX)/include/mozjs-45/" && exit 1)
	@test -e $(MOZJS_PREFIX)/lib/libmozjs-45.a || \
	  test -e $(MOZJS_PREFIX)/lib/libjs_static.a || \
	  (echo "FAIL: no libmozjs-45.a or libjs_static.a at $(MOZJS_PREFIX)/lib/" && exit 1)
	@echo "ok: $(MOZJS_PREFIX) looks usable"

test: $(BIN)
	./$(BIN) test/hello.js
	./$(BIN) test/require_chain.js
	./$(BIN) test/nm_resolution_smoke.js
	./$(BIN) test/fs_smoke.js
	./$(BIN) test/fs_dirs_smoke.js
	./$(BIN) test/fs_extras_smoke.js
	./$(BIN) test/timers_smoke.js
	./$(BIN) test/console_formatting.js
	./$(BIN) test/util_inspect_smoke.js
	./$(BIN) test/cores_smoke.js
	./$(BIN) test/integration.js
	./$(BIN) test/fibonacci.js
	./$(BIN) test/jit_smoke.js

test-libs: $(BIN)
	./$(BIN) test/marked_smoke.js
	./$(BIN) test/acorn_smoke.js
	./$(BIN) test/handlebars_smoke.js
	./$(BIN) test/lodash_smoke.js
	./$(BIN) test/semver_smoke.js
	./$(BIN) test/prettier_smoke.js
	./$(BIN) test/typescript_smoke.js
	./$(BIN) test/minimist_smoke.js
	./$(BIN) test/json5_smoke.js
	./$(BIN) test/mustache_smoke.js
	./$(BIN) test/jsyaml_smoke.js
	./$(BIN) test/kleur_smoke.js
	./$(BIN) test/commander_smoke.js
	./$(BIN) test/qs_smoke.js
	./$(BIN) test/diff_smoke.js
	./$(BIN) test/esprima_smoke.js
	./$(BIN) test/dayjs_smoke.js
	./$(BIN) test/beautify_smoke.js
	./$(BIN) test/babel_smoke.js
	./$(BIN) test/uuid_smoke.js
	./$(BIN) test/papaparse_smoke.js
	./$(BIN) test/tinycolor_smoke.js
	./$(BIN) test/spark_md5_smoke.js
	./$(BIN) test/fflate_smoke.js
	./$(BIN) test/pako_smoke.js
	./$(BIN) test/he_smoke.js
	./$(BIN) test/cryptojs_smoke.js
	./$(BIN) test/ajv_smoke.js
	./$(BIN) test/pegjs_smoke.js
	./$(BIN) test/nanoid_smoke.js
	./$(BIN) test/ms_smoke.js
	./$(BIN) test/strip_ansi_smoke.js
	./$(BIN) test/deepmerge_smoke.js
	./$(BIN) test/fast_deep_equal_smoke.js
	./$(BIN) test/color_convert_smoke.js
	./$(BIN) test/lunr_smoke.js
	./$(BIN) test/moment_smoke.js
	./$(BIN) test/showdown_smoke.js
	./$(BIN) test/object_hash_smoke.js
	./$(BIN) test/minimatch_smoke.js
	./$(BIN) test/validator_smoke.js
	./$(BIN) test/qrcode_smoke.js
	./$(BIN) test/tweetnacl_smoke.js
	./$(BIN) test/big_smoke.js
	./$(BIN) test/mime_types_smoke.js
	./$(BIN) test/markdown_it_smoke.js
	./$(BIN) test/sax_smoke.js
	./$(BIN) test/xml2js_smoke.js
	./$(BIN) test/prism_smoke.js
	./$(BIN) test/immer_smoke.js
	./$(BIN) test/chance_smoke.js
	./$(BIN) test/ini_smoke.js
	./$(BIN) test/slugify_smoke.js
	./$(BIN) test/mitt_smoke.js
	./$(BIN) test/ramda_smoke.js
	./$(BIN) test/pluralize_smoke.js
	./$(BIN) test/debug_smoke.js
	./$(BIN) test/basex_smoke.js
	./$(BIN) test/moo_smoke.js
	./$(BIN) test/clone_smoke.js
	./$(BIN) test/ejs_smoke.js
	./$(BIN) test/dequal_smoke.js
	./$(BIN) test/sm45_destructuring_defaults_repro.js
	./$(BIN) test/babel_fallback_smoke.js
	./$(BIN) test/iconv_smoke.js
	./$(BIN) test/nearley_smoke.js
	./$(BIN) test/bignumber_smoke.js
	./$(BIN) test/decimal_smoke.js
	./$(BIN) test/camelcase_smoke.js
	./$(BIN) test/pretty_bytes_smoke.js
	./$(BIN) test/figlet_smoke.js
	./$(BIN) test/fecha_smoke.js
	./$(BIN) test/randomcolor_smoke.js
	./$(BIN) test/classnames_smoke.js
	./$(BIN) test/tiny_emitter_smoke.js
	./$(BIN) test/stable_stringify_smoke.js
	./$(BIN) test/uniq_smoke.js
	./$(BIN) test/jszip_smoke.js

test-all: test test-libs

.PHONY: all clean check-mozjs test test-libs test-all
