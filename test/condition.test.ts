#!/usr/bin/env mocha -R spec

import {strict as assert} from "assert";
import * as express from "express";

import {requestHandler, responseHandler} from "../lib/express-intercept";
import {mwsupertest} from "./lib/middleware-supertest";

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

            await mwsupertest(app).getString(body => assert.equal(body, "/A/")).get("/A/").expect(200).expect("/A/");
            await mwsupertest(app).getString(body => assert.equal(body, "/BC/")).get("/BC/").expect(200).expect("/BC/");
            await mwsupertest(app).getString(body => assert.equal(body, "/D/")).get("/D/").expect(200).expect("/D/");
            await mwsupertest(app).getString(body => assert.equal(body, "/EF/")).get("/EF/").expect(200).expect("/EF/");
            await mwsupertest(app).getString(body => assert.equal(body, "/GH/")).get("/GH/").expect(200).expect("/GH/");
            await mwsupertest(app).getString(body => assert.equal(body, "//")).get("/X/").expect(200).expect("//");
        });
    }
    {
        it("if, for (async)", async () => {
            const app = express();

            app.use(responseHandler()
                .replaceString(async str => str + "/"));

            app.use(responseHandler()
                .if(async res => /A/.test(String(res.getHeader("x-path"))))
                .replaceString(async str => str + "A"));

            app.use(responseHandler()
                .if(async res => /B/.test(String(res.getHeader("x-path"))))
                .if(async res => /C/.test(String(res.getHeader("x-path"))))
                .replaceString(async str => str + "BC"));

            app.use(responseHandler()
                .for(async req => /D/.test(req.path))
                .replaceString(async str => str + "D"));

            app.use(responseHandler()
                .for(async req => /E/.test(req.path))
                .for(async req => /F/.test(req.path))
                .replaceString(async str => str + "EF"));

            app.use(responseHandler()
                .for(async req => /G/.test(req.path))
                .if(async res => /H/.test(String(res.getHeader("x-path"))))
                .replaceString(async str => str + "GH"));

            app.use(requestHandler().use(async (req, res) => {
                res.setHeader("x-path", req.path);
                res.send("/");
            }));

            await mwsupertest(app).getString(body => assert.equal(body, "/A/")).get("/A/").expect(200).expect("/A/");
            await mwsupertest(app).getString(body => assert.equal(body, "/BC/")).get("/BC/").expect(200).expect("/BC/");
            await mwsupertest(app).getString(body => assert.equal(body, "/D/")).get("/D/").expect(200).expect("/D/");
            await mwsupertest(app).getString(body => assert.equal(body, "/EF/")).get("/EF/").expect(200).expect("/EF/");
            await mwsupertest(app).getString(body => assert.equal(body, "/GH/")).get("/GH/").expect(200).expect("/GH/");
            await mwsupertest(app).getString(body => assert.equal(body, "//")).get("/X/").expect(200).expect("//");
        });
    }
});

