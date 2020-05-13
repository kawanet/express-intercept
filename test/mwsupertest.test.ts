#!/usr/bin/env mocha -R spec

import {strict as assert} from "assert";
import * as express from "express";
import {RequestHandler} from "express";
import {MWSuperTest, mwsupertest} from "./lib/middleware-supertest";

const TITLE = __filename.split("/").pop();

/**
 * This is a test to test mwsupertest itself.
 */

describe(TITLE, () => {
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

    function test(title: string, testApp: MWSuperTest) {
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
