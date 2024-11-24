#!/usr/bin/env mocha -R spec

import {strict as assert} from "assert";
import express from "express";
import {RequestHandler} from "express";
import {mwsupertest} from "./lib/middleware-supertest.js";

/**
 * This is a test to test mwsupertest itself.
 */

describe("mwsupertest.test.ts", () => {
    const success: RequestHandler = (req, res) => res.send("SUCCESS");
    const expect = "something wrong";
    const app = express().use(success);
    const thrower = async () => {
        throw new Error(expect);
    }

    test("getString", mwsupertest(app).getString(thrower));
    test("getBuffer", mwsupertest(app).getBuffer(thrower));
    test("getResponse", mwsupertest(app).getResponse(thrower));
    test("getRequest", mwsupertest(app).getRequest(thrower));

    function test(title: string, testApp: ReturnType<typeof mwsupertest>) {
        it(title, async () => {
            let error: Error;
            try {
                await testApp.get("/").expect(500);
            } catch (e) {
                error = e;
            }
            assert.ok(String(error).indexOf(expect) > -1, String(error));
        });
    }
});
