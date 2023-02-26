#!/usr/bin/env mocha -R spec

import * as express from "express";
import * as supertest from "supertest";
import type * as types from "../";

const TITLE = __filename.split("/").pop();

describe(TITLE, () => {

    let requestHandler: typeof types.requestHandler;

    before(async () => {
        const loaded = await import("../esm/express-intercept.mjs" as string);
        requestHandler = loaded.requestHandler;
    });

    it("requestHandler()", async () => {
        const app = express();

        app.get("/ok", requestHandler().use((req, res, next) => res.status(200).end()));

        await supertest(app).get("/ok").expect(200);

        await supertest(app).get("/ng").expect(404);
    });
});
