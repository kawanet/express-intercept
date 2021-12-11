#!/usr/bin/env mocha -R spec

import * as express from "express";

import {responseHandler} from "../";
import {mwsupertest} from "./lib/middleware-supertest";

const TITLE = __filename.split("/").pop();

const enum ETag {
    foo = `W/"3-C+7Hteo/D9vJXQ3UfzxbwnXaijM"`,
    FOO = `W/"3-/qtA4fynfHNgzMoUgbuLpfkZzjo"`,
}

describe(TITLE, () => {
    {
        it("304 Not Modified", async () => {
            const app = express();

            app.use("/upper/304", responseHandler().getResponse(res => (res.statusCode = 304)));
            app.use("/lower/304", responseHandler().getResponse(res => (res.statusCode = 304)));
            app.use("/upper/", responseHandler().replaceString(str => str.toUpperCase()));
            app.use("/", (req, res, next) => res.send("foo"));

            await mwsupertest(app).get("/lower/")
                .expect(200)
                .expect("foo")
                .expect("etag", ETag.foo);

            await mwsupertest(app).get("/upper/")
                .expect(200)
                .expect("FOO")
                .expect("etag", ETag.FOO);

            // response body must by empty on 304 Not Modified response

            await mwsupertest(app).get("/lower/304")
                .expect(304)
                .expect("")
                .expect("etag", ETag.foo);

            await mwsupertest(app).get("/upper/304")
                .expect(304)
                .expect("")
                .expect("etag", ETag.FOO);
        });
    }
});

