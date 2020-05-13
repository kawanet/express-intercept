// express-intercept.ts

import {Request, RequestHandler, Response} from "express";
import {Readable} from "stream";
import {ResponsePayload} from "./_payload";
import {buildRequestHandler, buildResponseHandler} from "./_builder";

type CondFn<T> = (arg: T) => boolean;

export const requestHandler = () => new RequestHandlerBuilder();

export const responseHandler = () => new ResponseHandlerBuilder();

class RequestHandlerBuilder {
    private _for: ((req: Request) => boolean);

    /**
     * It appends a test condition to perform the RequestHandler.
     * Call this for multiple times to add multiple tests in AND condition.
     * Those tests could avoid unnecessary work later.
     */

    for(condition: (req: Request) => boolean): this {
        this._for = (this._for && condition) ? AND<Request>(this._for, condition) : (this._for || condition);
        return this;
    }

    /**
     * It returns a RequestHandler which connects multiple RequestHandlers.
     * Use this after `requestHandler()` method but not after `responseHandlder()`.
     */

    use(handler: RequestHandler, ...more: RequestHandler[]): RequestHandler {
        for (const mw of more) {
            handler = (handler && mw) ? JOIN(handler, mw) : (handler || mw);
        }

        // NOP
        if (!handler) handler = (req, res, next) => next();

        return buildRequestHandler(this._for, handler);
    }

    /**
     * It returns a RequestHandler to inspect express Request object (aka `req`).
     * With `requestHandler()`, it works at request phase as normal RequestHandler works.
     */

    getRequest(receiver: (req: Request) => (any | Promise<any>)): RequestHandler {
        return (req, res, next) => {
            return Promise.resolve().then(() => receiver(req)).then(() => next(), next);
        }
    }
}

class ResponseHandlerBuilder extends RequestHandlerBuilder {
    private _if: ((res: Response) => boolean);
    use: never;

    /**
     * It appends a test condition to perform the RequestHandler.
     * Call this for multiple times to add multiple tests in AND condition.
     * Those tests could avoid unnecessary response interception work including additional buffering.
     */

    if(condition: (res: Response) => boolean): this {
        this._if = (this._if && condition) ? AND<Response>(this._if, condition) : (this._if || condition);
        return this;
    }

    /**
     * It returns a RequestHandler to replace the response content body as a string.
     * It gives a single string even when the response stream is chunked and/or compressed.
     */

    replaceString(replacer: (body: string, req?: Request, res?: Response) => (string | Promise<string>)): RequestHandler {
        return super.use(buildResponseHandler<ResponsePayload>(this._if, async (payload, req, res) => {
            let body = payload.getString();
            body = await replacer(body, req, res);
            payload.setString(body);
        }));
    }

    /**
     * It returns a RequestHandler to replace the response content body as a Buffer.
     * It gives a single Buffer even when the response stream is chunked and/or compressed.
     */

    replaceBuffer(replacer: (body: Buffer, req?: Request, res?: Response) => (Buffer | Promise<Buffer>)): RequestHandler {
        return super.use(buildResponseHandler<ResponsePayload>(this._if, async (payload, req, res) => {
            let body = payload.getBuffer();
            body = await replacer(body, req, res);
            payload.setBuffer(body);
        }));
    }

    /**
     * It returns a RequestHandler to replace the response content body as a stream.Readable.
     * Interceptor may need to decompress the response stream when compressed.
     * Interceptor should return yet another stream.Readable to perform transform the stream.
     * Interceptor would use stream.Transform for most cases as it is a Readable.
     * Interceptor could return null or the upstream itself as given if transformation not happened.
     */

    interceptStream(interceptor: (upstream: Readable, req: Request, res: Response) => (Readable | Promise<Readable>)): RequestHandler {
        return super.use(buildResponseHandler<Readable>(this._if, async (payload, req, res) => {
            return interceptor(payload, req, res);
        }, () => new ReadablePayload()));
    }

    /**
     * It returns a RequestHandler to retrieve the response content body as a string.
     * It gives a single string even when the response stream is chunked and/or compressed.
     */

    getString(receiver: (body: string, req?: Request, res?: Response) => (any | Promise<any>)): RequestHandler {
        return super.use(buildResponseHandler<ResponsePayload>(this._if, async (payload, req, res) => {
            const body = payload.getString();
            await receiver(body, req, res);
        }));
    }

    /**
     * It returns a RequestHandler to retrieve the response content body as a Buffer.
     * It gives a single Buffer even when the response stream is chunked and/or compressed.
     */

    getBuffer(receiver: (body: Buffer, req?: Request, res?: Response) => (any | Promise<any>)): RequestHandler {
        return super.use(buildResponseHandler<ResponsePayload>(this._if, async (payload, req, res) => {
            const body = payload.getBuffer();
            await receiver(body, req, res);
        }));
    }

    /**
     * It returns a RequestHandler to inspect express Request object (aka `req`).
     * With `responseHandlder()`, it works at response returning phase after `res.send()` fired.
     */

    getRequest(receiver: (req: Request) => (any | Promise<any>)): RequestHandler {
        return super.use(buildResponseHandler<ResponsePayload>(this._if, async (payload, req, res) => {
            await receiver(req);
        }));
    }

    /**
     * It returns a RequestHandler to inspect express Response object (aka `res`) on its response returning phase after res.send() fired.
     */

    getResponse(receiver: (res: Response) => (any | Promise<any>)): RequestHandler {
        return super.use(buildResponseHandler<ResponsePayload>(this._if, async (payload, req, res) => {
            await receiver(res);
        }));
    }
}

class ReadablePayload extends Readable {
    _read() {
        // don't care
    }
}

/**
 * @private
 */

function AND<T>(A: CondFn<T>, B: CondFn<T>): CondFn<T> {
    return (arg: T) => (A(arg) && B(arg));
}

function JOIN(A: RequestHandler, B: RequestHandler): RequestHandler {
    return (req, res, next) => A(req, res, err => (err ? next(err) : B(req, res, next)));
}
