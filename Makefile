ALL=\
	lib/express-intercept.js \
	esm/express-intercept.mjs \

all: $(ALL)

clean:
	/bin/rm -fr $(ALL) lib/*.js test/*.js build/

esm/%.mjs: build/esm/%.js
	rollup -o $@ -- $^

build/esm/%.js: lib/%.ts tsconfig-esm.json
	./node_modules/.bin/tsc -p tsconfig-esm.json

lib/%.js: lib/%.ts tsconfig.json
	./node_modules/.bin/tsc -p tsconfig.json

test: all
	./node_modules/.bin/mocha test/*.js

.PHONY: all clean test

.PRECIOUS: build/esm/%.js
