#!/usr/bin/env mocha -R spec

import {strict as assert} from "assert";
import * as express from "express";

import {requestHandler} from "../lib/express-intercept";
import {mwsupertest} from "./lib/middleware-supertest";
import {compress} from "./lib/compress";
import {decompress} from "./lib/decompress";

const TITLE = __filename.split("/").pop();

const responseHeader = (key: string) => requestHandler().use((req, res) => res.type("html").send(req.headers[key] || "-"));

const responseText = (body: string) => requestHandler().use((req, res) => res.type("text/plain").send(body));

const responseBinary = (body: Buffer) => requestHandler().use((req, res) => res.type("application/octet-stream").send(body));

describe(TITLE, () => {
    testText();
    testBinary();

    testFormat("gzip", "accept-encoding", "te", "content-encoding");
    testFormat("gzip", "te", "accept-encoding", "transfer-encoding");

    testFormat("deflate", "accept-encoding", "te", "content-encoding");
    testFormat("deflate", "te", "accept-encoding", "transfer-encoding");

    testFormat("br", "accept-encoding", "te", "content-encoding");
    testFormat("br", "te", "accept-encoding", "transfer-encoding");

    function testText() {
        const content = "TEXT";
        const router = express.Router();
        router.use(decompress(/^application/));
        router.use(compress(/^text/));
        router.use(responseText(content));

        it("text compression", async () => {
            const app = express().use(router);

            await mwsupertest(app)
                .getResponse(res => assert.ok(res.getHeader("content-encoding"))) // gzip or deflate
                .get("/")
                .expect(200)
                .then(res => assert.equal(res.text, content));

            await mwsupertest(app)
                .getString(body => assert.equal(body, content))
                .get("/")
                .expect(200)
                .then(res => assert.equal(res.text, content));
        });

        it("text decompression", async () => {
            const app = express().use(decompress(/^text/), router);

            await mwsupertest(app)
                .getResponse(res => assert.equal(res.getHeader("content-encoding") || "uncompressed", "uncompressed"))
                .get("/")
                .expect(200)
                .then(res => assert.equal(res.text, content));

            await mwsupertest(app)
                .getString(body => assert.equal(body, content))
                .get("/")
                .expect(200)
                .then(res => assert.equal(res.text, content));
        });
    }

    function testBinary() {
        const content = Buffer.from("BINARY");
        const router = express.Router();
        router.use(decompress(/^application/));
        router.use(compress(/^text/));
        router.use(responseBinary(content));

        it("binary compression skiped", async () => {
            const app = express().use(router);

            await mwsupertest(app)
                .getBuffer(body => assert.equal(toHEX(body), toHEX(content)))
                .getResponse(res => assert.equal(res.getHeader("content-encoding") || "uncompressed", "uncompressed"))
                .get("/")
                .expect(200)
                .then(res => assert.equal(toHEX(res.body), toHEX(content)));
        });

        it("binary compression", async () => {
            const app = express().use(compress(/^application/), router);

            await mwsupertest(app)
                .getResponse(res => assert.ok(res.getHeader("content-encoding"))) // gzip or deflate
                .get("/")
                .expect(200)
                .then(res => assert.equal(toHEX(res.body), toHEX(content)));
        });

        it("binary decompression", async () => {
            const app = express().use(decompress(), router);

            await mwsupertest(app)
                .getResponse(res => assert.equal(res.getHeader("content-encoding") || "uncompressed", "uncompressed"))
                .get("/")
                .expect(200)
                .then(res => assert.equal(toHEX(res.body), toHEX(content)));

            await mwsupertest(app)
                .getBuffer(body => assert.equal(toHEX(body), toHEX(content)))
                .get("/")
                .expect(200)
                .then(res => assert.equal(toHEX(res.body), toHEX(content)));
        });
    }

    function testFormat(format: string, incoming: string, removing: string, outgoing: string) {
        const router = express.Router();
        router.use(requestHandler().getRequest(req => req.headers[incoming] = format));
        router.use(requestHandler().getRequest(req => delete req.headers[removing]));
        router.use(compress());
        router.use(responseHeader(incoming));

        it(outgoing + ": " + format + " compression", async () => {
            const app = express().use(router);

            await mwsupertest(app)
                .getString(body => assert.equal(body, format))
                .getResponse(res => assert.equal(res.getHeader(outgoing), format))
                .get("/")
                .expect(200)
                .expect(outgoing, format);
        });

        it(outgoing + ": " + format + " decompression", async () => {
            const app = express().use(decompress(), router);

            await mwsupertest(app)
                .getString(body => assert.equal(body, format))
                .getResponse(res => assert.equal(res.getHeader(outgoing) || "uncompressed", "uncompressed"))
                .get("/")
                .expect(200)
                .expect(format);
        });
    }
});

function toHEX(buf: Buffer) {
    return Buffer.from(buf).toString("hex");
}
