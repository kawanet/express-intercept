#!/usr/bin/env mocha -R spec

import {strict as assert} from "assert";
import * as express from "express";

import {responseHandler} from "../lib/express-intercept";
import {mwsupertest} from "./lib/middleware-supertest";

const TITLE = __filename.split("/").pop();

describe(TITLE, () => {
    const empty = "";
    const source = "Hello, {{name}}!";
    const expected = "Hello, John!";

    {
        it("replaceString", async () => {
            const app = express();
            app.use(responseHandler().replaceString(str => str.replace("{{name}}", "John")));
            app.use((req, res) => res.send(source))

            await mwsupertest(app)
                .getResponse(res => assert.equal(+res.statusCode, 200))
                .getResponse(res => assert.equal(+res.getHeader("content-length"), expected.length))
                .getString(body => assert.equal(body, expected))
                .get("/")
                .expect(200)
                .then(res => assert.equal(res.text, expected));
        });
    }

    {
        it("replaceString async", async () => {
            const app = express();
            app.use(responseHandler().replaceString(async str => str.replace("{{name}}", "John")));
            app.use((req, res) => res.send(source))

            await mwsupertest(app)
                .getResponse(res => assert.equal(+res.statusCode, 200))
                .getResponse(res => assert.equal(+res.getHeader("content-length"), expected.length))
                .getString(body => assert.equal(body, expected))
                .get("/")
                .expect(200)
                .then(res => assert.equal(res.text, expected));
        });
    }

    {
        it("replaceString to empty", async () => {
            const app = express();
            app.use(responseHandler().replaceString(async () => empty));
            app.use((req, res) => res.send(source))

            await mwsupertest(app)
                .getResponse(res => assert.equal(+res.statusCode, 200))
                .getResponse(res => assert.equal(+res.getHeader("content-length") | 0, 0))
                .getString(body => assert.equal(body, empty))
                .get("/")
                .expect(200)
                .then(res => assert.equal(res.text || "empty", "empty"));
        });
    }

    {
        it("replaceString from empty", async () => {
            const app = express();
            app.use(responseHandler().replaceString(async () => expected));
            app.use((req, res) => res.send(empty))

            await mwsupertest(app)
                .getResponse(res => assert.equal(+res.statusCode, 200))
                .getResponse(res => assert.equal(+res.getHeader("content-length"), expected.length))
                .getString(body => assert.equal(body, expected))
                .get("/")
                .expect(200)
                .then(res => assert.equal(res.text, expected));
        });
    }
});
