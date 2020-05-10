#!/usr/bin/env mocha -R spec

import {strict as assert} from "assert";
import * as express from "express";

import {requestHandler} from "../lib/express-intercept";
import {middlewareTest} from "./lib/middleware-test";
import {compress} from "./lib/compress";
import {decompress} from "./lib/decompress";

const TITLE = __filename.split("/").pop();

const responseHandler = (key: string) => requestHandler().use((req, res) => res.type("html").send(req.headers[key] || "-"));

describe(TITLE, () => {

    {
        it("default", async () => {
            let app = express();
            app.use(compress());
            app.use(responseHandler("default"));

            await middlewareTest(app)
                .getString(body => assert.equal(body, "-"))
                .get("/").expect("-");

            app = express().use(decompress(), app);

            await middlewareTest(app)
                .getString(body => assert.equal(body, "-"))
                .get("/").expect("-");
        });
    }

    test("accept-encoding", "te", "content-encoding");

    test("te", "accept-encoding", "transfer-encoding");

});

function test(incoming: string, removing: string, outgoing: string) {

    {
        it(outgoing + ": gzip", async () => {
            let app = express();
            app.use(requestHandler().getRequest(req => req.headers[incoming] = "gzip"));
            app.use(requestHandler().getRequest(req => delete req.headers[removing]));
            app.use(compress());
            app.use(responseHandler(incoming));

            await middlewareTest(app)
                .getString(body => assert.equal(body, "gzip"))
                .getResponse(res => assert.equal(res.getHeader(outgoing), "gzip"))
                .get("/");

            app = express().use(decompress(), app);

            await middlewareTest(app)
                .getString(body => assert.equal(body, "gzip"))
                .getResponse(res => assert.equal(res.getHeader(outgoing), undefined))
                .get("/").expect("gzip");
        });
    }

    {
        it(outgoing + ": deflate", async () => {
            let app = express();
            app.use(requestHandler().getRequest(req => req.headers[incoming] = "deflate"));
            app.use(requestHandler().getRequest(req => delete req.headers[removing]));
            app.use(compress());
            app.use(responseHandler(incoming));

            await middlewareTest(app)
                .getString(body => assert.equal(body, "deflate"))
                .getResponse(res => assert.equal(res.getHeader(outgoing), "deflate"))
                .get("/");

            app = express().use(decompress(), app);

            await middlewareTest(app)
                .getString(body => assert.equal(body, "deflate"))
                .getResponse(res => assert.equal(res.getHeader(outgoing), undefined))
                .get("/").expect("deflate");
        });
    }

    {
        it(outgoing + ": br", async () => {
            let app = express();
            app.use(requestHandler().getRequest(req => req.headers[incoming] = "br"));
            app.use(requestHandler().getRequest(req => delete req.headers[removing]));
            app.use(compress());
            app.use(responseHandler(incoming));

            await middlewareTest(app)
                .getString(body => assert.equal(body, "br"))
                .getResponse(res => assert.equal(res.getHeader(outgoing), "br"))
                .get("/");

            app = express().use(decompress(), app);

            await middlewareTest(app)
                .getString(body => assert.equal(body, "br"))
                .getResponse(res => assert.equal(res.getHeader(outgoing), undefined))
                .get("/").expect("br");
        });
    }
}
