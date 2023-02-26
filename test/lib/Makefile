ALL=\
	middleware-supertest.ts \
	middleware-supertest.d.ts \

all: $(ALL)

clean:
	/bin/rm -f $(ALL)

middleware-supertest.ts:
	curl -s https://raw.githubusercontent.com/kawanet/middleware-supertest/master/lib/middleware-supertest.ts | \
	    sed 's#"express-intercept"#"../../lib/express-intercept"#; s#"../"#"./middleware-supertest.d"#' > $@

middleware-supertest.d.ts:
	curl -s https://raw.githubusercontent.com/kawanet/middleware-supertest/master/types/middleware-supertest.d.ts -o $@

.PHONY: all clean
