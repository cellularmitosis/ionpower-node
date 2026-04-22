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

BIN = ionpower-node

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
	./$(BIN) test/fs_smoke.js
	./$(BIN) test/fs_dirs_smoke.js
	./$(BIN) test/timers_smoke.js
	./$(BIN) test/console_formatting.js
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

test-all: test test-libs

.PHONY: all clean check-mozjs test test-libs test-all
