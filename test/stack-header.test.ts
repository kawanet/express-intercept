#!/usr/bin/env mocha -R spec

import express from "express";

import {responseHandler} from "../";
import {mwsupertest} from "./lib/middleware-supertest.js";
import {stackRequestHeader} from "./lib/stack-request-header.js";

describe("stack-header.test.ts", () => {
    const addResponseHeader = (key: string) => responseHandler().interceptStream((upstream, req, res) => {
        res.setHeader(key, (req.header("x-foo") || "---") + "/" + (req.header("x-bar") || "---"));
        return upstream;
    });

    it("stackRequestHeader()", async () => {
        const app = express();
        app.use(addResponseHeader("x-ret1"));
        app.use(stackRequestHeader({"x-foo": "FOO"}));
        app.use(addResponseHeader("x-ret2"));
        app.use(stackRequestHeader({"x-bar": "BAR"}));
        app.use(addResponseHeader("x-ret3"));
        app.use(stackRequestHeader({"x-foo": "BAZ"}));
        app.use(addResponseHeader("x-ret4"));
        app.use((req, res) => res.send("OK"));

        await mwsupertest(app)
            .get("/")
            .set({"x-bar": "QUX"})
            .expect(200)
            .expect("x-ret1", "---/QUX")
            .expect("x-ret2", "FOO/QUX")
            .expect("x-ret3", "FOO/BAR")
            .expect("x-ret4", "BAZ/BAR")
            .expect("OK");
    });
});
