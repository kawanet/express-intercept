#!/usr/bin/env mocha -R spec

import {strict as assert} from "assert";
import * as express from "express";
import * as zlib from "zlib";

import {requestHandler, responseHandler} from "../lib/express-intercept";
import {mwsupertest} from "./lib/middleware-supertest";

const TITLE = __filename.split("/").pop();

describe(TITLE, () => {
    test("gzip", zlib.gzipSync);
    test("deflate", zlib.deflateSync);
    test("br", zlib.brotliCompressSync);

    it("multiple compression", async () => {
        const app = express();
        app.use(responseHandler().compressResponse());
        app.use(responseHandler().compressResponse());
        app.use(responseHandler().compressResponse());
        app.use(requestHandler().use((req, res) => res.send("SUCCESS")));

        await mwsupertest(app)
            .get("/")
            .expect(200)
            .expect("SUCCESS");
    });

    it("Accept-Encoding: identity", async () => {
        const app = express();
        const content = "Accept-Encoding: identity";

        app.use(requestHandler().getRequest(req => req.headers["accept-encoding"] = "identity"));

        // compressed
        app.use(responseHandler().getResponse(res => res.setHeader("x-encoding-2", String(res.getHeader("content-encoding") || "(uncompressed)"))));
        app.use(responseHandler().getResponse(res => res.setHeader("x-length-2", String(res.getHeader("content-length")))));

        // compression
        app.use(responseHandler().compressResponse());

        // uncompressed
        app.use(responseHandler().getResponse(res => res.setHeader("x-encoding-1", String(res.getHeader("content-encoding") || "(uncompressed)"))));
        app.use(responseHandler().getResponse(res => res.setHeader("x-length-1", String(res.getHeader("content-length")))));

        // response uncompressed body
        app.use(requestHandler().use((req, res) => res.type("text/html").send(content)));

        await mwsupertest(app)
            .get("/")
            .expect(200)
            .expect("x-encoding-1", "(uncompressed)")
            .expect("x-length-1", String(content.length))
            .expect("x-encoding-2", "(uncompressed)")
            .expect("x-length-2", String(content.length))
            .expect(res => assert.equal(res.text, content));
    });
});

function test(encoding: string, encoder: (buf: Buffer) => Buffer) {
    it(encoding, async () => {
        const content = `encoding=${encoding}`;
        const expected = `[encoding=${encoding}]`;
        const app = express();

        app.use(requestHandler().getRequest(req => req.headers["accept-encoding"] = encoding));

        // decompressed
        app.use(responseHandler().getResponse(res => res.setHeader("x-encoding-4", String(res.getHeader("content-encoding") || "(uncompressed)"))));
        app.use(responseHandler().getResponse(res => res.setHeader("x-length-4", String(res.getHeader("content-length")))));

        // decompression
        app.use(responseHandler().decompressResponse());

        // compressed
        app.use(responseHandler().getResponse(res => res.setHeader("x-encoding-3", String(res.getHeader("content-encoding") || "(uncompressed)"))));

        // You don't need to decompress the body as it is already decompressed before replaceString() calls the replacer function here.
        app.use(responseHandler().replaceString(body => `[${body}]`));

        // compressed
        app.use(responseHandler().getResponse(res => res.setHeader("x-encoding-2", String(res.getHeader("content-encoding") || "(uncompressed)"))));

        // compression
        app.use(responseHandler().compressResponse());

        // uncompressed
        app.use(responseHandler().getResponse(res => res.setHeader("x-length-1", String(res.getHeader("content-length")))));
        app.use(responseHandler().getResponse(res => res.setHeader("x-encoding-1", String(res.getHeader("content-encoding") || "(uncompressed)"))));

        // response uncompressed body
        app.use(requestHandler().use((req, res) => res.type("text/html").send(content)));

        await mwsupertest(app)
            .get("/")
            .expect(200)
            .expect("x-encoding-1", "(uncompressed)")
            .expect("x-length-1", String(content.length))
            .expect("x-encoding-2", encoding)
            .expect("x-encoding-3", encoding)
            .expect("x-encoding-4", "(uncompressed)")
            .expect("x-length-4", String(expected.length))
            .expect(res => assert.equal(res.text, expected));
    });
}
