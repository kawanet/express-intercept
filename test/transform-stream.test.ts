#!/usr/bin/env mocha -R spec

import {strict as assert} from "assert";
import * as express from "express";

import {responseHandler} from "../lib/express-intercept";
import {middlewareTest} from "./lib/middleware-test";
import {Transform} from "stream";
import {RequestHandler} from "express";

const TITLE = __filename.split("/").pop();

describe(TITLE, () => {
    const source = "Hello, world!";
    const expected = "HELLO, WORLD!!";

    const replacer = (body: string) => {
        body = String(body).toUpperCase();
        body = body.replace(/!/g, "!!");
        return body;
    };

    test("transform stream: send()", (req, res) => {
        res.send(source);
    });

    test("transform stream: write()", (req, res) => {
        res.status(200).type("html");
        res.write(source);
        res.end();
    });

    test("transform stream: end()", (req, res) => {
        res.status(200).type("html");
        res.end(source);
    });

    test("transform stream: chunked", (req, res) => {
        res.status(200).type("html");
        source.split("").forEach(c => res.write(c));
        res.end();
    });

    test("transform string: chunked", (req, res) => {
        res.status(200).type("html");
        source.split("").forEach(c => res.write(c));
        res.end();
    }, responseHandler().replaceString(replacer));

    function test(name: string, handler: RequestHandler, transform?: RequestHandler) {
        it(name, async () => {
            const app = express();

            app.use(transform || responseHandler().transformStream((req, res) => {
                return new Transform({
                    transform(chunk, encoding, callback) {
                        res.removeHeader("Content-Length");
                        chunk = Buffer.from(replacer(String(chunk)));
                        this.push(chunk)
                        callback();
                    }
                })
            }));

            app.use(handler);

            await middlewareTest(app)
                .getString(body => assert.equal(body, expected))
                .get("/")
                .expect(expected);
        });
    }
});
