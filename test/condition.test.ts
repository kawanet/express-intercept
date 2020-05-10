#!/usr/bin/env mocha -R spec

import {strict as assert} from "assert";
import * as express from "express";

import {requestHandler, responseHandler} from "../lib/express-intercept";
import {middlewareTest} from "./lib/middleware-test";

const TITLE = __filename.split("/").pop();

describe(TITLE, () => {
    {
        it("if, for", async () => {
            const app = express();

            app.use(responseHandler()
                .replaceString(str => str + "/"));

            app.use(responseHandler()
                .if(res => /A/.test(String(res.getHeader("x-path"))))
                .replaceString(str => str + "A"));

            app.use(responseHandler()
                .if(res => /B/.test(String(res.getHeader("x-path"))))
                .if(res => /C/.test(String(res.getHeader("x-path"))))
                .replaceString(str => str + "BC"));

            app.use(responseHandler()
                .for(req => /D/.test(req.path))
                .replaceString(str => str + "D"));

            app.use(responseHandler()
                .for(req => /E/.test(req.path))
                .for(req => /F/.test(req.path))
                .replaceString(str => str + "EF"));

            app.use(responseHandler()
                .for(req => /G/.test(req.path))
                .if(res => /H/.test(String(res.getHeader("x-path"))))
                .replaceString(str => str + "GH"));

            app.use(requestHandler().use((req, res) => {
                res.setHeader("x-path", req.path);
                res.send("/");
            }));

            await middlewareTest(app).getString(body => assert.equal(body, "/A/")).get("/A/").expect("/A/");
            await middlewareTest(app).getString(body => assert.equal(body, "/BC/")).get("/BC/").expect("/BC/");
            await middlewareTest(app).getString(body => assert.equal(body, "/D/")).get("/D/").expect("/D/");
            await middlewareTest(app).getString(body => assert.equal(body, "/EF/")).get("/EF/").expect("/EF/");
            await middlewareTest(app).getString(body => assert.equal(body, "/GH/")).get("/GH/").expect("/GH/");
            await middlewareTest(app).getString(body => assert.equal(body, "//")).get("/X/").expect("//");
        });
    }
});

