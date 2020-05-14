#!/usr/bin/env mocha -R spec

import {strict as assert} from "assert";
import * as express from "express";
import {RequestHandler} from "express";

import {responseHandler} from "../lib/express-intercept";
import {mwsupertest} from "./lib/middleware-supertest";

const TITLE = __filename.split("/").pop();

const silentHandler = () => responseHandler((err, req, res) => res.status(500).end());

describe(TITLE, () => {
    const success: RequestHandler = (req, res) => res.send("SUCCESS");
    // const NOP: RequestHandler = (req, res, next) => next();

    it("200", async () => {
        const app = express().use(success);
        await mwsupertest(app).get("/").expect(200).expect("SUCCESS");
    });

    it("500", async () => {
        const app = express().use((req, res) => res.status(500).end());
        await mwsupertest(app).get("/").expect(500);
    });

    // Express.js captures errors thrown at upstream requestHandler methods.
    // We need only handle errors thrown at downstream responseHandler methods.

    test("responseHandler().if()", silentHandler().if(() => {
        throw new Error("if()");
    }).getRequest(() => null));

    test("responseHandler().replaceString()", silentHandler().replaceString(() => {
        throw new Error("replaceString()");
    }));

    test("responseHandler().replaceBuffer()", silentHandler().replaceBuffer(() => {
        throw new Error("replaceBuffer()");
    }));

    test("responseHandler().interceptStream()", silentHandler().interceptStream(() => {
        throw new Error("interceptStream()");
    }));

    test("responseHandler().getString()", silentHandler().getString(() => {
        throw new Error("getString()");
    }));

    test("responseHandler().getBuffer()", silentHandler().getBuffer(() => {
        throw new Error("getBuffer()");
    }));

    test("responseHandler().getRequest()", silentHandler().getRequest(() => {
        throw new Error("getRequest()");
    }));

    test("responseHandler().getResponse()", silentHandler().getResponse(() => {
        throw new Error("getResponse()");
    }));

    function test(title: string, mw: RequestHandler) {
        it(title, async () => {
            const app = express().use(mw).use(success);

            await mwsupertest(app)
                .getResponse(res => assert.equal(+res.statusCode, 500))
                .getString(body => assert.equal(body || "(empty)", "(empty)"))
                .getResponse(res => assert.equal(+res.header("content-length") | 0, 0))
                .get("/")
                .expect(500);
        });
    }
});
