// express-intercept.ts

import {Request, RequestHandler, Response} from "express";
import {Readable} from "stream";
import {ResponsePayload} from "./_payload";
import {buildResponseHandler} from "./_handler";
import {findEncoding} from "./_compression";

type CondFn<T> = (arg: T) => boolean;

type NextFunction = (err?: any) => void;
type ErrorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => void;
// type RequestHandler = (req: Request, res: Response, next: NextFunction) => void;

export const requestHandler = (errorHandler?: ErrorHandler) => new RequestHandlerBuilder(errorHandler);

export const responseHandler = (errorHandler?: ErrorHandler) => new ResponseHandlerBuilder(errorHandler);

const NOP: RequestHandler = (req, res, next) => next();

const defaultErrorHandler: ErrorHandler = (err, req, res, next) => {
    console.error(err);
    res.status(500).set({"Content-Length": "0"}).end();
};

class RequestHandlerBuilder {
    constructor(errorHandler?: ErrorHandler) {
        this._error = errorHandler || defaultErrorHandler;
    }

    _error: ErrorHandler;

    /**
     * It appends a test condition to perform the RequestHandler.
     * Call this for multiple times to add multiple tests in AND condition.
     * Those tests could avoid unnecessary work later.
     */

    for(condition: (req: Request) => boolean): this {
        this._for = (this._for && condition) ? AND<Request>(this._for, condition) : (this._for || condition);
        return this;
    }

    _for: ((req: Request) => boolean);

    /**
     * It returns a RequestHandler which connects multiple RequestHandlers.
     * Use this after `requestHandler()` method but not after `responseHandlder()`.
     */

    use(handler: RequestHandler, ...more: RequestHandler[]): RequestHandler {
        for (const mw of more) {
            if (mw) handler = handler ? JOIN(handler, mw) : mw;
        }

        if (!handler) handler = NOP;

        if (this._for) handler = IF(this._for, handler);

        return asyncHandler(handler, this._error);
    }

    /**
     * It returns a RequestHandler to inspect express Request object (aka `req`).
     * With `requestHandler()`, it works at request phase as normal RequestHandler works.
     */

    getRequest(receiver: (req: Request) => (any | Promise<any>)): RequestHandler {
        return this.use(async (req, res, next) => {
            await receiver(req);
            next();
        });
    }
}

class ResponseHandlerBuilder extends RequestHandlerBuilder {
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

    _if: ((res: Response) => boolean);

    /**
     * It returns a RequestHandler to replace the response content body as a string.
     * It gives a single string even when the response stream is chunked and/or compressed.
     */

    replaceString(replacer: (body: string, req?: Request, res?: Response) => (string | Promise<string>)): RequestHandler {
        return super.use(buildResponseHandler<ResponsePayload>(this, async (payload, req, res) => {
            const body = payload.getString();
            const replaced = await replacer(body, req, res);
            if (body === replaced) return; // nothing changed
            payload.setString(replaced);
        }));
    }

    /**
     * It returns a RequestHandler to replace the response content body as a Buffer.
     * It gives a single Buffer even when the response stream is chunked and/or compressed.
     */

    replaceBuffer(replacer: (body: Buffer, req?: Request, res?: Response) => (Buffer | Promise<Buffer>)): RequestHandler {
        return super.use(buildResponseHandler<ResponsePayload>(this, async (payload, req, res) => {
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
        return super.use(buildResponseHandler<Readable>(this, async (payload, req, res) => {
            return interceptor(payload, req, res);
        }, () => new ReadablePayload()));
    }

    /**
     * It returns a RequestHandler to retrieve the response content body as a string.
     * It gives a single string even when the response stream is chunked and/or compressed.
     */

    getString(receiver: (body: string, req?: Request, res?: Response) => (any | Promise<any>)): RequestHandler {
        return super.use(buildResponseHandler<ResponsePayload>(this, async (payload, req, res) => {
            const body = payload.getString();
            await receiver(body, req, res);
        }));
    }

    /**
     * It returns a RequestHandler to retrieve the response content body as a Buffer.
     * It gives a single Buffer even when the response stream is chunked and/or compressed.
     */

    getBuffer(receiver: (body: Buffer, req?: Request, res?: Response) => (any | Promise<any>)): RequestHandler {
        return super.use(buildResponseHandler<ResponsePayload>(this, async (payload, req, res) => {
            const body = payload.getBuffer();
            await receiver(body, req, res);
        }));
    }

    /**
     * It returns a RequestHandler to inspect express Request object (aka `req`).
     * With `responseHandlder()`, it works at response returning phase after `res.send()` fired.
     */

    getRequest(receiver: (req: Request) => (any | Promise<any>)): RequestHandler {
        return super.use(buildResponseHandler<ResponsePayload>(this, async (payload, req, res) => {
            await receiver(req);
        }));
    }

    /**
     * It returns a RequestHandler to inspect express Response object (aka `res`) on its response returning phase after res.send() fired.
     */

    getResponse(receiver: (res: Response) => (any | Promise<any>)): RequestHandler {
        return super.use(buildResponseHandler<ResponsePayload>(this, async (payload, req, res) => {
            await receiver(res);
        }));
    }

    compressResponse(): RequestHandler {
        return this.replaceBuffer((buf, req, res) => {
            const encoding = findEncoding(req.header("Accept-Encoding"));
            res.setHeader("Content-Encoding", encoding); // signal to compress with the encoding
            return buf;
        });
    }

    decompressResponse(): RequestHandler {
        return this.replaceBuffer((buf, req, res) => {
            res.removeHeader("Content-Encoding"); // signal not to compress again
            return buf;
        });
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

function IF(tester: (arg: Request) => boolean, handler: RequestHandler): RequestHandler {
    return (req, res, next) => tester(req) ? handler(req, res, next) : next();
}

function JOIN(A: RequestHandler, B: RequestHandler): RequestHandler {
    return (req, res, next) => A(req, res, err => (err ? next(err) : B(req, res, next)));
}

function asyncHandler(handler: RequestHandler, errorHandler?: ErrorHandler): RequestHandler {
    return async (req, res, next) => {
        try {
            return await handler(req, res, cb);
        } catch (err) {
            return cb(err);
        }

        function cb(err?: Error) {
            if (!next) return;
            const _next = next;
            next = null; // ignore next

            if (err && errorHandler) {
                return errorHandler(err, req, res, _next);
            } else {
                return _next(err);
            }
        }
    }
}
