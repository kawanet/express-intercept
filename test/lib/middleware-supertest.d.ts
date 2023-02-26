/// <reference types="node" />

import type {Request, RequestHandler, Response} from "express";
import type * as supertest from "supertest";

export const mwsupertest: (app: RequestHandler) => MWSuperTest;

/**
 * Testing Express.js RequestHandler middlewares both on server-side and client-side
 */
interface MWSuperTest {
    use(mw: RequestHandler): this;

    /**
     * defines a test function to test the response body as a `string` on server-side.
     */
    getString(checker: (str: string) => (any | Promise<any>)): this;

    /**
     * defines a test function to test the response body as a `Buffer` on server-side.
     */
    getBuffer(checker: (buf: Buffer) => (any | Promise<any>)): this;

    /**
     * defines a test function to test the response object aka `res` on server-side.
     */
    getRequest(checker: (req: Request) => (any | Promise<any>)): this;

    /**
     * defines a test function to test the request object aka `req` on server-side.
     */
    getResponse(checker: (res: Response) => (any | Promise<any>)): this;

    /**
     * perform a HTTP `DELETE` request and returns a SuperTest object to continue tests on client-side.
     */
    delete(url: string): supertest.Test;

    /**
     * perform a HTTP `GET` request and returns a SuperTest object to continue tests on client-side.
     */
    get(url: string): supertest.Test;

    /**
     * perform a HTTP `HEAD` request and returns a SuperTest object to continue tests on client-side.
     */
    head(url: string): supertest.Test;

    /**
     * perform a HTTP `POST` request and returns a SuperTest object to continue tests on client-side.
     */
    post(url: string): supertest.Test;

    /**
     * perform a HTTP `PUT` request and returns a SuperTest object to continue tests on client-side.
     */
    put(url: string): supertest.Test;
}
