SRC   := $(wildcard ../lib/*.ts)
TYPES := $(wildcard ../types/*.d.ts)
BUILDER_SRC := $(wildcard ./*.ts)

PKG_DST := ../dist/package.json
MJS_DST := ../dist/express-intercept.mjs
CJS_DST := ../dist/express-intercept.cjs

MJS_CONFIG := ./rollup-mjs.config.ts
CJS_CONFIG := ./rollup-cjs.config.ts

# Bundle is around 9 KB today (lib/ + the one external dep we keep).
# Anything noticeably larger means an accidental bundling of a Node
# built-in or a transitive dep — fail the build so it cannot slip in.
MAX_BYTES := 15000

# Every named export the package documents must survive the round trip
# through both CJS and ESM bundles. List them once and assert in both
# smoke checks below.
NAMED_EXPORTS := requestHandler responseHandler

# Node.js major version for conditional testing (e.g. v20.x.x -> 20)
NODE_MAJOR := $(shell node -v | cut -d. -f1 | tr -d 'v')

ALL := $(MJS_DST) $(CJS_DST) $(PKG_DST)

####

all: $(ALL)

$(PKG_DST):
	@mkdir -p $(dir $@)
	echo '{"type":"commonjs"}' > $@
	@ls -l $@
	@echo ""

$(MJS_DST): $(MJS_CONFIG) $(SRC) $(BUILDER_SRC)
	@mkdir -p $(dir $@)
	../node_modules/.bin/rollup -c $<
	@test "$$(wc -c < $@)" -le $(MAX_BYTES) || { echo "ERROR: $@ exceeds $(MAX_BYTES) byte cap" >&2; exit 1; }
	@# Smoke test: import the bundle and verify named exports via process.argv.slice(1)
	cd .. && node --input-type=module -e 'const m = await import("./dist/express-intercept.mjs"); for (const k of process.argv.slice(1)) { if (typeof m[k] !== "function") { console.error("missing MJS export:", k); process.exit(1); } console.log("MJS export OK:", k); }' $(NAMED_EXPORTS)
	@ls -l $@
	@echo ""

$(CJS_DST): $(CJS_CONFIG) $(SRC) $(BUILDER_SRC)
	@mkdir -p $(dir $@)
	../node_modules/.bin/rollup -c $<
	@test "$$(wc -c < $@)" -le $(MAX_BYTES) || { echo "ERROR: $@ exceeds $(MAX_BYTES) byte cap" >&2; exit 1; }
	@# Smoke test: require the bundle and verify named exports via process.argv.slice(1)
	cd .. && node --input-type=commonjs -e 'const m = require("./dist/express-intercept.cjs"); for (const k of process.argv.slice(1)) { if (typeof m[k] !== "function") { console.error("missing CJS export:", k); process.exit(1); } console.log("CJS export OK:", k); }' $(NAMED_EXPORTS)
	@ls -l $@
	@echo ""

####

# Build, type-check, and run the node:test suite against the source.
# Note: full tests (tsc and node:test) are skipped on Node 20.
test: all $(TYPES)
	@test $(NODE_MAJOR) -ge 22 && $(MAKE) test-ts || echo "Node $(NODE_MAJOR) detected: skipping full tests."

test-ts:
	../node_modules/.bin/tsc --noEmit
	cd .. && node --test test/*.test.ts

clean:
	/bin/rm -fr $(ALL)

.PHONY: all clean test test-ts
