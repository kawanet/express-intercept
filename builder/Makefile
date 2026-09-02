# Force bash so `set -o pipefail` works in the recipes below.
SHELL := bash
.SHELLFLAGS := -eo pipefail -c

SRC   := $(wildcard ../lib/*.ts)
TEST_SRC := $(wildcard ../test/*.test.ts ../test/lib/*.ts)
TYPES := $(wildcard ../types/*.d.ts)
BUILDER_SRC := $(wildcard ./*.ts)

MJS_DST := ../dist/express-intercept.mjs
CJS_DST := ../dist/express-intercept.cjs
TESTS_DST := ./tests/bundled.mjs

MJS_CONFIG := ./rollup-mjs.config.ts
CJS_CONFIG := ./rollup-cjs.config.ts
TESTS_CONFIG := ./rollup-tests.config.ts

# The bundle is around 9 KB today (lib/ + one external dependency).
# If it gets significantly larger, it might indicate an accidental inclusion
# of a Node.js built-in or a transitive dependency.
MAX_BYTES := 15000

# Same purpose as the cap above: a jump past this means the test bundle
# accidentally inlined library sources or a dependency.
TEST_MAX_BYTES := 60000

ALL := $(MJS_DST) $(CJS_DST)

# Build/test paths require Node's native TypeScript type-strip (default on
# Node 22.18+). Older runtimes (e.g. Node 20) report BUILDABLE=NO and can
# still verify pre-built bundles via the builder/pack targets.
BUILDABLE := $(shell node -e 'console.log(process.features.typescript ? "YES" : "NO")')

####

# Build all artifacts.
all: is-buildable $(ALL)

# Gate consumed by `all` and `npm prepack` so a build starts only where it
# can finish: with native type-strip and the devDependencies installed.
is-buildable:
	@ [ "$(BUILDABLE)" = "YES" ] && [ -f ../node_modules/.bin/rollup ]

# Inverse gate for `npm prepare`: a consumer install skips build/test and
# relies on prebuilt artifacts; contributors build on a capable runtime.
is-not-buildable:
	@ [ "$(BUILDABLE)" != "YES" ] || [ ! -f ../node_modules/.bin/rollup ]

$(MJS_DST): $(MJS_CONFIG) $(SRC) $(BUILDER_SRC)
	@mkdir -p $(dir $@)
	../node_modules/.bin/rollup -c $<
	@ls -l $@
	@test "$$(wc -c < $@)" -le $(MAX_BYTES) || { echo "ERROR: $@ exceeds $(MAX_BYTES) byte cap" >&2; exit 1; }
	@echo ""

$(CJS_DST): $(CJS_CONFIG) $(SRC) $(BUILDER_SRC)
	@mkdir -p $(dir $@)
	../node_modules/.bin/rollup -c $<
	@ls -l $@
	@test "$$(wc -c < $@)" -le $(MAX_BYTES) || { echo "ERROR: $@ exceeds $(MAX_BYTES) byte cap" >&2; exit 1; }
	@echo ""

# Plain-JS bundle of the test suites, importing the package by name.
# Runs against dist/ on any supported Node runtime without type-strip.
$(TESTS_DST): $(TESTS_CONFIG) $(SRC) $(BUILDER_SRC) $(TEST_SRC) $(MJS_DST)
	@mkdir -p $(dir $@)
	../node_modules/.bin/rollup -c $<
	@ls -l $@
	@test "$$(wc -c < $@)" -le $(TEST_MAX_BYTES) || { echo "ERROR: $@ exceeds $(TEST_MAX_BYTES) byte cap" >&2; exit 1; }
	@echo ""

####

# Consumer `npm install` skips the heavy test-full step to keep install fast.
# `npm pack` re-runs prepare for a fresh build; tests are skipped there too
# because CI runs them explicitly around the pack, while `npm publish`
# reports npm_command=publish and still gets the full run.
test:
	@case "$$npm_command" in \
		install|ci|pack) echo "npm $$npm_command detected: skipping full tests." ;; \
		*) $(MAKE) test-full ;; \
	esac

test-full: all
	cd .. && node_modules/.bin/tsc --noEmit
	cd .. && node_modules/.bin/ts-refine format --check && node_modules/.bin/ts-refine imports --check
	cd .. && node --test test/*.test.ts

####

clean:
	/bin/rm -fr $(ALL) $(TESTS_DST)

.PHONY: all clean test test-full is-buildable is-not-buildable
