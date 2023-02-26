// middleware-supertest.ts

import * as express from "express";
import type {Request, RequestHandler, Response} from "express";
import {responseHandler} from "../../lib/express-intercept";
import * as supertest from "supertest";
import type * as types from "./middleware-supertest.d";

export const mwsupertest: typeof types.mwsupertest = app => new MWSuperTest(app);

/**
 * Testing Express.js RequestHandler middlewares both on server-side and client-side
 */

class MWSuperTest implements types.MWSuperTest {
    private _agent: supertest.SuperTest<any>;
    private handlers = express.Router();

    constructor(private app: RequestHandler) {
        //
    }

    private agent() {
        return this._agent || (this._agent = supertest(express().use(this.handlers).use(this.app)));
    }

    use(mw: RequestHandler): this {
        this.handlers.use(mw);
        this._agent = null;
        return this;
    }

    /**
     * defines a test function to test the response body as a `string` on server-side.
     */

    getString(checker: (str: string) => (any | Promise<any>)): this {
        return this.use(responseHandler().getString((str, req, res) => {
            return Promise.resolve(str).then(checker).catch(err => catchError(err, req, res));
        }));
    }

    /**
     * defines a test function to test the response body as a `Buffer` on server-side.
     */

    getBuffer(checker: (buf: Buffer) => (any | Promise<any>)): this {
        return this.use(responseHandler().getBuffer((buf, req, res) => {
            return Promise.resolve(buf).then(checker).catch(err => catchError(err, req, res));
        }));
    }

    /**
     * defines a test function to test the response object aka `res` on server-side.
     */

    getRequest(checker: (req: Request) => (any | Promise<any>)): this {
        return this.use(responseHandler().getBuffer((buf, req, res) => {
            return Promise.resolve().then(() => checker(req)).catch(err => catchError(err, req, res));
        }));
    }

    /**
     * defines a test function to test the request object aka `req` on server-side.
     */

    getResponse(checker: (res: Response) => (any | Promise<any>)): this {
        return this.use(responseHandler().getBuffer((buf, req, res) => {
            return Promise.resolve().then(() => checker(res)).catch(err => catchError(err, req, res));
        }));
    }

    /**
     * perform a HTTP `DELETE` request and returns a SuperTest object to continue tests on client-side.
     */

    delete(url: string) {
        return wrapRequest(this.agent().delete.apply(this.agent, arguments));
    }

    /**
     * perform a HTTP `GET` request and returns a SuperTest object to continue tests on client-side.
     */

    get(url: string) {
        return wrapRequest(this.agent().get.apply(this.agent, arguments));
    }

    /**
     * perform a HTTP `HEAD` request and returns a SuperTest object to continue tests on client-side.
     */

    head(url: string) {
        return wrapRequest(this.agent().head.apply(this.agent, arguments));
    }

    /**
     * perform a HTTP `POST` request and returns a SuperTest object to continue tests on client-side.
     */

    post(url: string) {
        return wrapRequest(this.agent().post.apply(this.agent, arguments));
    }

    /**
     * perform a HTTP `PUT` request and returns a SuperTest object to continue tests on client-side.
     */

    put(url: string) {
        return wrapRequest(this.agent().put.apply(this.agent, arguments));
    }
}

/**
 * @private
 */

function wrapRequest(req: supertest.Request): supertest.Test {
    const _req = req as unknown as { assert: (resError: any, res: any, fn: any) => void };
    const _assert = _req.assert;
    _req.assert = function (resError, res, fn) {
        let err: string = res?.header["x-mwsupertest"];
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

/**
 * @private
 */

function catchError(err: string | Error, req: Request, res: Response) {
    if (!err) err = "error";

    if ("string" !== typeof err) {
        err = err.stack || err.message || err + "";
    }

    err = Buffer.from(err).toString("base64");
    res.setHeader("x-mwsupertest", err);
}
