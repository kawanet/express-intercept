#!/usr/bin/env mocha -R spec

import {strict as assert} from "assert";
import * as express from "express";
import {Request, Response} from "express";

import {requestHandler, responseHandler} from "../";
import {mwsupertest} from "./lib/middleware-supertest";

const TITLE = __filename.split("/").pop();

describe(TITLE, () => {
    {
        it("getResponse, getResponse", async () => {
            const app = express();

            app.use(requestHandler().getRequest(req => req.headers["x-req-req"] = "A"));
            app.use(responseHandler().getRequest(req => req.headers["x-req-res"] = "B"));
            app.use(responseHandler().getResponse(res => res.setHeader("x-res-res", "D")));

            app.use((req: Request, res: Response) => {
                const reqreq = req.headers["x-req-req"] || "-";
                const reqres = req.headers["x-req-res"] || "-";
                const resreq = res.getHeader("x-res-req") || "-";
                const resres = res.getHeader("x-res-res") || "-";
                const body = [reqreq, reqres, resreq, resres].join("");
                res.send(body);
            })

            await mwsupertest(app)
                .getString(body => assert.equal(body, "A---"))
                .getRequest(req => assert.equal(req.headers["x-req-req"], "A"))
                .getRequest(req => assert.equal(req.headers["x-req-res"], "B"))
                .getResponse(res => assert.equal(res.getHeader("x-res-res"), "D"))
                .get("/")
                .expect(200)
                .expect("A---");
        });
    }

    {
        it("getString, getBuffer", async () => {
            const app = express();

            app.use(responseHandler().getString((str, req, res) => res.setHeader("x-string", str)));

            app.use(responseHandler().getBuffer((buf, req, res) => res.setHeader("x-buffer", Buffer.from(buf).toString("hex"))));

            app.use((req, res) => res.send("FOO"));

            await mwsupertest(app)
                .getString(body => assert.equal(body, "FOO"))
                .getResponse(res => assert.equal(res.getHeader("x-string") as string, "FOO"))
                .getResponse(res => assert.equal(res.getHeader("x-buffer") as string, Buffer.from("FOO").toString("hex")))
                .get("/")
                .expect(200)
                .expect("FOO");
        });
    }
});
