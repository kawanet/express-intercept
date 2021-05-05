#!/usr/bin/env mocha -R spec

import {strict as assert} from "assert";
import * as express from "express";
import {RequestHandler} from "express";

import {responseHandler} from "../";
import {mwsupertest} from "./lib/middleware-supertest";

const TITLE = __filename.split("/").pop();

const silentHandler = () => responseHandler((err, req, res) => res.status(500).end());

describe(TITLE, () => {

    const success: RequestHandler = (req, res) => res.send("SUCCESS");

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

    it("responseHandler().if()", async () => {
        await test(silentHandler().if(() => {
            throw new Error("if()");
        }).getRequest(() => null));
    });

    it("responseHandler().replaceString()", async () => {
        await test(silentHandler().replaceString(() => {
            throw new Error("replaceString()");
        }));
    });

    it("responseHandler().replaceBuffer()", async () => {
        await test(silentHandler().replaceBuffer(() => {
            throw new Error("replaceBuffer()");
        }));
    });

    it("responseHandler().interceptStream()", async () => {
        await test(silentHandler().interceptStream(() => {
            throw new Error("interceptStream()");
        }));
    });

    it("responseHandler().getString()", async () => {
        await test(silentHandler().getString(() => {
            throw new Error("getString()");
        }));
    });

    it("responseHandler().getBuffer()", async () => {
        await test(silentHandler().getBuffer(() => {
            throw new Error("getBuffer()");
        }));
    });

    it("responseHandler().getRequest()", async () => {
        await test(silentHandler().getRequest(() => {
            throw new Error("getRequest()");
        }));
    });

    it("responseHandler().getResponse()", async () => {
        await test(silentHandler().getResponse(() => {
            throw new Error("getResponse()");
        }));
    });

    async function test(mw: RequestHandler): Promise<void> {
        {
            const app = express().use(mw).use(success);

            await mwsupertest(app)
                .getResponse(res => assert.equal(+res.statusCode, 500))
                .getString(body => assert.equal(body || "(empty)", "(empty)"))
                .getResponse(res => assert.equal(+res.header("content-length") | 0, 0))
                .get("/")
                .expect(500);
        }
    }
});
