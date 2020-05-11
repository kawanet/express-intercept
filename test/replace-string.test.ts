#!/usr/bin/env mocha -R spec

import {strict as assert} from "assert";
import * as express from "express";

import {responseHandler} from "../lib/express-intercept";
import {middlewareTest} from "./lib/middleware-test";

const TITLE = __filename.split("/").pop();

describe(TITLE, () => {
    const empty = "";
    const source = "Hello, {{name}}!";
    const expected = "Hello, John!";

    {
        it("replace", async () => {
            const app = express();
            app.use(responseHandler().replaceString(str => str.replace("{{name}}", "John")));
            app.use((req, res) => res.send(source))

            await middlewareTest(app)
                .getResponse(res => assert.equal(+res.statusCode, 200))
                .getResponse(res => assert.equal(+res.getHeader("content-length"), expected.length))
                .getString(body => assert.equal(body, expected))
                .get("/")
                .expect(200)
                .then(res => assert.equal(res.text, expected));
        });
    }

    {
        it("to empty", async () => {
            const app = express();
            app.use(responseHandler().replaceString(str => empty));
            app.use((req, res) => res.send(source))

            await middlewareTest(app)
                .getResponse(res => assert.equal(+res.statusCode, 200))
                .getResponse(res => assert.equal(+res.getHeader("content-length") | 0, 0))
                .getString(body => assert.equal(body, empty))
                .get("/")
                .expect(200)
                .then(res => assert.equal(res.text || "empty", "empty"));
        });
    }

    {
        it("from empty", async () => {
            const app = express();
            app.use(responseHandler().replaceString(str => expected));
            app.use((req, res) => res.send(empty))

            await middlewareTest(app)
                .getResponse(res => assert.equal(+res.statusCode, 200))
                .getResponse(res => assert.equal(+res.getHeader("content-length"), expected.length))
                .getString(body => assert.equal(body, expected))
                .get("/")
                .expect(200)
                .then(res => assert.equal(res.text, expected));
        });
    }
});
