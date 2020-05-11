#!/usr/bin/env mocha -R spec

import {strict as assert} from "assert";
import * as express from "express";
import {RequestHandler} from "express";

import {responseHandler} from "../lib/express-intercept";
import {middlewareTest} from "./lib/middleware-test";

const TITLE = __filename.split("/").pop();

describe(TITLE, () => {
    const success: RequestHandler = (req, res) => res.send("SUCCESS");
    // const NOP: RequestHandler = (req, res, next) => next();

    it("200", async () => {
        const app = express().use(success);
        await middlewareTest(app).get("/").expect(200).expect("SUCCESS");
    });

    it("500", async () => {
        const app = express().use((req, res) => res.status(500).end());
        await middlewareTest(app).get("/").expect(500);
    });

    // Express.js captures errors thrown at upstream requestHandler methods.
    // We need only handle errors thrown at downstream responseHandler methods.

    test("responseHandler().if()", responseHandler().if(() => {
        throw new Error("if()");
    }).getRequest(() => null));

    test("responseHandler().replaceString()", responseHandler().replaceString(() => {
        throw new Error("replaceString()");
    }));

    test("responseHandler().replaceBuffer()", responseHandler().replaceBuffer(() => {
        throw new Error("replaceBuffer()");
    }));

    test("responseHandler().getString()", responseHandler().getString(() => {
        throw new Error("getString()");
    }));

    test("responseHandler().getBuffer()", responseHandler().getBuffer(() => {
        throw new Error("getBuffer()");
    }));

    test("responseHandler().getRequest()", responseHandler().getRequest(() => {
        throw new Error("getRequest()");
    }));

    test("responseHandler().getResponse()", responseHandler().getResponse(() => {
        throw new Error("getResponse()");
    }));

    test("responseHandler().transformStream()", responseHandler().transformStream(() => {
        throw new Error("transformStream()");
    }));

    function test(title: string, mw: RequestHandler) {
        it(title, async () => {
            const app = express().use(mw).use(success);

            await middlewareTest(app)
                .getResponse(res => assert.equal(+res.statusCode, 500))
                .getString(body => assert.equal(body || "(empty)", "(empty)"))
                .getResponse(res => assert.equal(+res.header("content-length") | 0, 0))
                .get("/")
                .expect(500);
        });
    }
});
