# Force bash so `set -o pipefail` works in the recipes below.
SHELL := bash
.SHELLFLAGS := -eo pipefail -c

# A target name in builder/, not a path from here.
TESTS_DST := ./tests/bundled.mjs

# The workflows drive these steps in order:
#   nodejs.yml   pack bundled unpack test
#   publish.yml  bundled test-dist

# Package-side lifecycle: `pack` builds the tarball (renamed to the fixed
# packed.tgz), `unpack` installs it (--no-save also works in a checkout),
# `test` exercises it. Build `bundled` only after `pack`: npm pack runs
# prepare, whose clean wipes the generated test bundle.
all: pack

pack: clean
	cd ../.. && npm pack --pack-destination builder/pack
	mv *-*.*.*.tgz packed.tgz

bundled:
	$(MAKE) -C .. $(TESTS_DST)

# The lane has no manifest, so the test-only peers the suites need come
# from builder/pack/package.json. It names no package and declares no
# exports, which is what keeps a self-reference from beating node_modules.
# A checkout has its own manifest and keeps it.
unpack:
	cd ../.. && [ -e package.json ] || cp builder/pack/package.json package.json
	cd ../.. && npm install ./builder/pack/packed.tgz --no-audit --no-fund --no-save

test: test-bundled

# Resolves through node_modules after `unpack`; inside a checkout the
# package name self-references dist/ instead.
test-bundled:
	cd ../.. && node --test builder/tests/bundled.mjs

# Publish gate: the same behavior checks, run against the checkout's own
# staged artifacts in place -- the self-reference above is what makes the
# two roots interchangeable, so no tarball install is involved here.
test-dist: test-bundled

clean:
	/bin/rm -f *.tgz

.PHONY: all pack bundled unpack test test-bundled test-dist clean
