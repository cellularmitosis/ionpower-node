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
       src/node_compat/http.cpp \
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
	./$(BIN) test/hashids_smoke.js
	./$(BIN) test/jmespath_smoke.js
	./$(BIN) test/seedrandom_smoke.js
	./$(BIN) test/alea_smoke.js
	./$(BIN) test/escape_html_smoke.js
	./$(BIN) test/rfc6902_smoke.js
	./$(BIN) test/fast_memoize_smoke.js
	./$(BIN) test/tiny_warning_smoke.js
	./$(BIN) test/crypto_hash_smoke.js
	./$(BIN) test/htmlparser2_smoke.js
	./$(BIN) test/jsonwebtoken_smoke.js
	./$(BIN) test/eventemitter3_smoke.js
	./$(BIN) test/indent_string_smoke.js
	./$(BIN) test/safe_json_stringify_smoke.js
	./$(BIN) test/leven_smoke.js
	./$(BIN) test/strnum_smoke.js
	./$(BIN) test/xregexp_smoke.js
	./$(BIN) test/htmlescape_smoke.js
	./$(BIN) test/qhash_smoke.js
	./$(BIN) test/escape_regexp_smoke.js
	./$(BIN) test/object_path_smoke.js
	./$(BIN) test/currency_smoke.js
	./$(BIN) test/arr_union_diff_smoke.js
	./$(BIN) test/deep_extend_smoke.js
	./$(BIN) test/http_smoke.js
	./$(BIN) test/cookie_smoke.js
	./$(BIN) test/cookie_signature_smoke.js
	./$(BIN) test/bytes_smoke.js
	./$(BIN) test/content_type_smoke.js
	./$(BIN) test/base64js_smoke.js
	./$(BIN) test/json_logic_smoke.js
	./$(BIN) test/is_plain_obj_smoke.js
	./$(BIN) test/emoji_regex_smoke.js
	./$(BIN) test/murmurhash_smoke.js
	./$(BIN) test/xxhashjs_smoke.js
	./$(BIN) test/jsbn_smoke.js
	./$(BIN) test/crc32_smoke.js
	./$(BIN) test/fastest_levenshtein_smoke.js
	./$(BIN) test/flatten_smoke.js
	./$(BIN) test/fnv_plus_smoke.js
	./$(BIN) test/left_pad_smoke.js
	./$(BIN) test/just_smoke.js
	./$(BIN) test/format_util_smoke.js
	./$(BIN) test/jsonpointer_smoke.js
	./$(BIN) test/traverse_smoke.js
	./$(BIN) test/fraction_smoke.js
	./$(BIN) test/bit_buffer_smoke.js
	./$(BIN) test/clsx_smoke.js
	./$(BIN) test/tiny_invariant_smoke.js
	./$(BIN) test/diff_match_patch_smoke.js
	./$(BIN) test/circular_json_smoke.js
	./$(BIN) test/flatted_smoke.js
	./$(BIN) test/big_integer_smoke.js
	./$(BIN) test/diff_sequences_smoke.js
	./$(BIN) test/reselect_smoke.js
	./$(BIN) test/array_move_smoke.js
	./$(BIN) test/split_on_first_smoke.js
	./$(BIN) test/url_parse_smoke.js
	./$(BIN) test/ipaddr_smoke.js
	./$(BIN) test/tinypure_smoke.js
	./$(BIN) test/unorm_smoke.js
	./$(BIN) test/glob_to_regexp_smoke.js
	./$(BIN) test/assert_plus_smoke.js
	./$(BIN) test/longest_streak_smoke.js
	./$(BIN) test/zero_fill_smoke.js
	./$(BIN) test/ua_parser_smoke.js
	./$(BIN) test/preact_smoke.js
	./$(BIN) test/extend_smoke.js
	./$(BIN) test/dot_smoke.js
	./$(BIN) test/lz_string_smoke.js
	./$(BIN) test/parse_ms_smoke.js
	./$(BIN) test/ip_regex_smoke.js
	./$(BIN) test/char_regex_smoke.js
	./$(BIN) test/safer_buffer_smoke.js
	./$(BIN) test/cookiejar_smoke.js
	./$(BIN) test/arg_smoke.js
	./$(BIN) test/atob_btoa_smoke.js
	./$(BIN) test/urldecode_smoke.js
	./$(BIN) test/safe_stable_stringify_smoke.js
	./$(BIN) test/tinypreds_smoke.js
	./$(BIN) test/buffer_crc32_smoke.js
	./$(BIN) test/tsv_smoke.js
	./$(BIN) test/object_assign_smoke.js
	./$(BIN) test/small_utils_smoke.js
	./$(BIN) test/simple_statistics_smoke.js
	./$(BIN) test/heap_smoke.js
	./$(BIN) test/tinydate_smoke.js
	./$(BIN) test/sjcl_smoke.js
	./$(BIN) test/number_to_words_smoke.js
	./$(BIN) test/is_url_smoke.js
	./$(BIN) test/humanize_duration_smoke.js
	./$(BIN) test/slug_smoke.js
	./$(BIN) test/jwt_decode_smoke.js
	./$(BIN) test/color_utils_smoke.js
	./$(BIN) test/base64_smoke.js
	./$(BIN) test/case_smoke.js
	./$(BIN) test/tslib_smoke.js
	./$(BIN) test/anchorme_smoke.js
	./$(BIN) test/numeral_smoke.js
	./$(BIN) test/inflection_smoke.js
	./$(BIN) test/oauth_sign_smoke.js
	./$(BIN) test/fromentries_smoke.js
	./$(BIN) test/fast_equals_smoke.js
	./$(BIN) test/diff2html_smoke.js
	./$(BIN) test/hoopy_smoke.js
	./$(BIN) test/fast_sort_smoke.js
	./$(BIN) test/jsonparse_smoke.js
	./$(BIN) test/pretty_compact_smoke.js
	./$(BIN) test/path_libs_smoke.js
	./$(BIN) test/ansi_escapes_smoke.js
	./$(BIN) test/yocto_queue_smoke.js
	./$(BIN) test/cron_smoke.js

test-all: test test-libs

.PHONY: all clean check-mozjs test test-libs test-all
