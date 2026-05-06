SRC   := $(wildcard ../lib/*.ts)
TYPES := $(wildcard ../types/*.d.ts)
BUILDER_SRC := $(wildcard ./*.ts)

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

ALL := $(MJS_DST) $(CJS_DST)

# Build/test paths require Node's native TypeScript type-strip (default on
# Node 22.18+). Older runtimes (e.g. Node 20) report BUILDABLE=NO and can
# still verify pre-built bundles via `make smoke`.
BUILDABLE := $(shell node -e 'console.log(process.features.typescript ? "YES" : "NO")')

####

# Build all artifacts.
all: is-buildable $(ALL)

# Gate that fails loudly when type-strip is unavailable; consumed by `all`
# and by `npm prepack` to refuse packaging on a non-buildable runtime.
is-buildable:
	@ [ "$(BUILDABLE)" = "YES" ]

# Inverse gate used by `npm prepare` to short-circuit on a non-buildable
# runtime so consumer install on Node 20 silently skips build/test.
is-not-buildable:
	@ [ "$(BUILDABLE)" = "NO" ]

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

# Verify the bundles by importing/requiring the package itself.
# This ensures the public entrypoints (exports/main) are correctly configured.
# Note: process.argv.slice(1) is used because `node -e 'code' arg1 arg2`
# results in process.argv = ['node', 'arg1', 'arg2'].
smoke: smoke-mjs smoke-cjs

# MJS smoke test via public entrypoint.
smoke-mjs: $(MJS_DST)
	cd .. && node --input-type=module -e 'const m = await import("express-intercept"); for (const k of process.argv.slice(1)) { if (typeof m[k] !== "function") { console.error("missing MJS export:", k); process.exit(1); } console.log("MJS export OK:", k); }' $(NAMED_EXPORTS)

# CJS smoke test via public entrypoint.
smoke-cjs: $(CJS_DST)
	cd .. && node --input-type=commonjs -e 'const m = require("express-intercept"); for (const k of process.argv.slice(1)) { if (typeof m[k] !== "function") { console.error("missing CJS export:", k); process.exit(1); } console.log("CJS export OK:", k); }' $(NAMED_EXPORTS)

####

# Build, run smoke tests, and conditionally run full tests (tsc and node:test).
# 1. Skip on Node.js 20 (already EOL).
# 2. Skip during 'npm install' (npm_command=install) to prevent redundant tests in CI and local dev.
# Informative messages are shown when skipping.
test: all smoke $(TYPES)
	@ [ "$$npm_command" != "install" ] || echo "npm install detected: skipping full tests."
	@ [ "$$npm_command" = "install" ] || $(MAKE) test-ts

# Actual test commands requiring Node.js 22+.
test-ts:
	../node_modules/.bin/tsc --noEmit
	cd .. && node --test test/*.test.ts

clean:
	/bin/rm -fr $(ALL)

.PHONY: all clean test smoke test-ts is-buildable is-not-buildable smoke-mjs smoke-cjs
