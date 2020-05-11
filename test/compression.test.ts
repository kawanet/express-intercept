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

    test("gzip", "accept-encoding", "te", "content-encoding");
    test("gzip", "te", "accept-encoding", "transfer-encoding");

    test("deflate", "accept-encoding", "te", "content-encoding");
    test("deflate", "te", "accept-encoding", "transfer-encoding");

    test("br", "accept-encoding", "te", "content-encoding");
    test("br", "te", "accept-encoding", "transfer-encoding");
});

function test(format: string, incoming: string, removing: string, outgoing: string) {
    {
        let app = express();
        app.use(requestHandler().getRequest(req => req.headers[incoming] = format));
        app.use(requestHandler().getRequest(req => delete req.headers[removing]));
        app.use(compress());
        app.use(responseHandler(incoming));

        it(outgoing + ": " + format, async () => {
            await middlewareTest(app)
                .getString(body => assert.equal(body, format))
                .getResponse(res => assert.equal(res.getHeader(outgoing), format))
                .get("/").expect(outgoing, format);

            app = express().use(decompress(), app);

            await middlewareTest(app)
                .getString(body => assert.equal(body, format))
                .getResponse(res => assert.equal(res.getHeader(outgoing), undefined))
                .get("/").expect(format);
        });
    }
}
