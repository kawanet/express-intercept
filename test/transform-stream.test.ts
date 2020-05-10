#!/usr/bin/env mocha -R spec

import {strict as assert} from "assert";
import * as express from "express";

import {requestHandler, responseHandler} from "../lib/express-intercept";
import {middlewareTest} from "./lib/middleware-test";
import {Transform} from "stream";

const TITLE = __filename.split("/").pop();

describe(TITLE, () => {
    {
        it("transformStream()", async () => {
            const app = express();
            const source = "Hello, world!";
            const expected = "HELLO, WORLD!!";

            app.use(responseHandler().transformStream((req, res) => {
                return new Transform({
                    transform(chunk, encoding, callback) {
                        res.removeHeader("Content-Length");
                        let body = String(chunk).toUpperCase();
                        body = body.replace(/!/g, "!!");
                        chunk = Buffer.from(body);
                        this.push(chunk)
                        callback();
                    }
                })
            }));

            app.use(requestHandler().use((req, res) => res.send(source)));

            await middlewareTest(app).getString(body => assert.equal(body, expected)).get("/");
        });
    }
});
