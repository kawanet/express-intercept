import * as express from "express";
import {Request, RequestHandler, Response} from "express";
import {responseHandler} from "../../lib/express-intercept";
import * as request from "supertest";
import * as supertest from "supertest";

export const middlewareTest = (app: RequestHandler) => new MiddlewareTest(app);

export class MiddlewareTest {
    private _agent: supertest.SuperTest<any>;
    private handlers = express.Router();

    constructor(private app: RequestHandler) {
        //
    }

    agent() {
        return this._agent || (this._agent = request(express().use(this.handlers).use(this.app)));
    }

    use(mw: RequestHandler): this {
        this.handlers.use(mw);
        this._agent = null;
        return this;
    }

    getString(tester: (str: string) => any): this {
        return this.use(responseHandler().getString((str, req, res) => {
            return Promise.resolve(str).then(tester).catch(err => catchError(err, req, res));
        }));
    }

    getBuffer(tester: (buf: Buffer) => any): this {
        return this.use(responseHandler().getBuffer((buf, req, res) => {
            return Promise.resolve(buf).then(tester).catch(err => catchError(err, req, res));
        }));
    }

    getRequest(teseter: (req: Request) => any): this {
        return this.use(responseHandler().getBuffer((buf, req, res) => {
            return Promise.resolve().then(() => teseter(req)).catch(err => catchError(err, req, res));
        }));
    }

    getResponse(teseter: (res: Response) => any): this {
        return this.use(responseHandler().getBuffer((buf, req, res) => {
            return Promise.resolve().then(() => teseter(res)).catch(err => catchError(err, req, res));
        }));
    }

    delete(url: string) {
        return wrapRequest(this.agent().delete.apply(this.agent, arguments));
    }

    get(url: string) {
        return wrapRequest(this.agent().get.apply(this.agent, arguments));
    }

    head(url: string) {
        return wrapRequest(this.agent().head.apply(this.agent, arguments));
    }

    post(url: string) {
        return wrapRequest(this.agent().post.apply(this.agent, arguments));
    }

    put(url: string) {
        return wrapRequest(this.agent().put.apply(this.agent, arguments));
    }
}

function wrapRequest(req: request.Request): supertest.Test {
    const _req = req as unknown as { assert: (resError: any, res: any, fn: any) => void };
    const _assert = _req.assert;
    _req.assert = function (resError, res, fn) {
        let err: string = res.header["x-error"];
        if (err) {
            err = Buffer.from(err, "base64").toString();
            resError = new Error(err);
            res = null;
        }
        if (_assert) {
            return _assert.call(this, resError, res, fn);
        }
    };
    return req as supertest.Test;
}

function catchError(err: string | Error, req: Request, res: Response) {
    if (!err) err = "error";
    const e: Error = err as Error;
    err = e.stack || e.message || err;
    err = Buffer.from(err).toString("base64");
    res.setHeader("x-error", err);
}
