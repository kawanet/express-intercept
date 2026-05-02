SRC   := $(wildcard ../lib/*.ts)
TYPES := $(wildcard ../types/*.d.ts)
BUILDER_SRC := $(wildcard ./*.ts)

PKG_DST := ../dist/package.json
MJS_DST := ../dist/express-intercept.mjs
CJS_DST := ../dist/express-intercept.cjs

MJS_CONFIG := ./rollup-mjs.config.ts
CJS_CONFIG := ./rollup-cjs.config.ts

# The bundle is around 9 KB today (lib/ + one external dependency).
# If it gets significantly larger, it might indicate an accidental inclusion
# of a Node.js built-in or a transitive dependency.
MAX_BYTES := 15000

# Documentation-specified named exports that must be verified in the bundles.
NAMED_EXPORTS := requestHandler responseHandler

ALL := $(MJS_DST) $(CJS_DST) $(PKG_DST)

####

# Build all artifacts.
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
	@ls -l $@
	@echo ""

$(CJS_DST): $(CJS_CONFIG) $(SRC) $(BUILDER_SRC)
	@mkdir -p $(dir $@)
	../node_modules/.bin/rollup -c $<
	@test "$$(wc -c < $@)" -le $(MAX_BYTES) || { echo "ERROR: $@ exceeds $(MAX_BYTES) byte cap" >&2; exit 1; }
	@ls -l $@
	@echo ""

# Verify the bundles by importing/requiring them and checking named exports.
# Note: process.argv.slice(1) is used because node -e 'code' arg1 arg2
# results in process.argv = ['node', 'arg1', 'arg2'].
smoke: all
	@# MJS smoke test
	cd .. && node --input-type=module -e 'const m = await import("./dist/express-intercept.mjs"); for (const k of process.argv.slice(1)) { if (typeof m[k] !== "function") { console.error("missing MJS export:", k); process.exit(1); } console.log("MJS export OK:", k); }' $(NAMED_EXPORTS)
	@# CJS smoke test
	cd .. && node --input-type=commonjs -e 'const m = require("./dist/express-intercept.cjs"); for (const k of process.argv.slice(1)) { if (typeof m[k] !== "function") { console.error("missing CJS export:", k); process.exit(1); } console.log("CJS export OK:", k); }' $(NAMED_EXPORTS)

####

# Build, run smoke tests, type-check, and run the full node:test suite against the source.
# Note: Full tests (tsc and node:test) require Node.js 22+.
test: all smoke $(TYPES)
	../node_modules/.bin/tsc --noEmit
	cd .. && node --test test/*.test.ts

clean:
	/bin/rm -fr $(ALL)

.PHONY: all clean test smoke
