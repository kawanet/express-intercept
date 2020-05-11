#!/usr/bin/env mocha -R spec

import {strict as assert} from "assert";
import * as express from "express";

import {responseHandler} from "../lib/express-intercept";
import {middlewareTest} from "./lib/middleware-test";

const TITLE = __filename.split("/").pop();

describe(TITLE, () => {
    const empty = Buffer.of();
    const source = Buffer.from("ABCD");
    const expected = Buffer.from("XYZ");

    {
        it("replace", async () => {
            const app = express();
            app.use(responseHandler().replaceBuffer(buf => expected));
            app.use((req, res) => res.type("application/octet-stream").end(source))

            await middlewareTest(app)
                .getResponse(res => assert.equal(+res.statusCode, 200))
                .getResponse(res => assert.equal(+res.getHeader("content-length"), expected.length))
                .getBuffer(body => assert.equal(toHEX(body), toHEX(expected)))
                .get("/")
                .then(res => assert.equal(toHEX(res.body), toHEX(expected)));
        });
    }

    {
        it("to empty", async () => {
            const app = express();
            app.use(responseHandler().replaceBuffer(buf => empty));
            app.use((req, res) => res.type("application/octet-stream").send(source))

            await middlewareTest(app)
                .getResponse(res => assert.equal(+res.statusCode, 200))
                .getResponse(res => assert.equal(+res.getHeader("content-length") | 0, 0))
                .getBuffer(body => assert.equal(toHEX(body), toHEX(empty)))
                .get("/")
                .then(res => assert.equal(toHEX(res.body), toHEX(empty)));
        });
    }

    {
        it("from empty", async () => {
            const app = express();
            app.use(responseHandler().replaceBuffer(buf => expected));
            app.use((req, res) => res.type("application/octet-stream").send(empty))

            await middlewareTest(app)
                .getResponse(res => assert.equal(+res.statusCode, 200))
                .getResponse(res => assert.equal(+res.getHeader("content-length"), expected.length))
                .getBuffer(body => assert.equal(toHEX(body), toHEX(expected)))
                .get("/")
                .then(res => assert.equal(toHEX(res.body), toHEX(expected)));
        });
    }
});

function toHEX(buf: Buffer) {
    return Buffer.from(buf).toString("hex") || "(empty)";
}
