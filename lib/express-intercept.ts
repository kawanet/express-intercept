// express-intercept.ts

import {ErrorRequestHandler, Request, RequestHandler, Response} from "express";
import {Readable} from "stream";
import {ResponsePayload} from "./_payload";
import {buildResponseHandler} from "./_handler";
import {findEncoding} from "./_compression";
import {IF, ASYNC, CATCH} from "async-request-handler";

type CondFn<T> = (arg: T) => (boolean | Promise<boolean>);

export function requestHandler(errorHandler?: ErrorRequestHandler) {
    return new RequestHandlerBuilder(errorHandler || defaultErrorHandler);
}

export function responseHandler(errorHandler?: ErrorRequestHandler) {
    return new ResponseHandlerBuilder(errorHandler || defaultErrorHandler);
}

const defaultErrorHandler: ErrorRequestHandler = (err, req, res, next) => {
    console.error(err);
    res.status(500).set({"Content-Length": "0"}).end();
};

class RequestHandlerBuilder {
    constructor(errorHandler?: ErrorRequestHandler) {
        this._error = errorHandler;
    }

    _error: ErrorRequestHandler;

    /**
     * It appends a test condition to perform the RequestHandler.
     * Call this for multiple times to add multiple tests in AND condition.
     * Those tests could avoid unnecessary work later.
     */

    for(condition: (req: Request) => (boolean | Promise<boolean>)): this {
        this._for = AND<Request>(this._for, condition);
        return this;
    }

    _for: ((req: Request) => (boolean | Promise<boolean>));

    /**
     * It returns a RequestHandler which connects multiple RequestHandlers.
     * Use this after `requestHandler()` method but not after `responseHandlder()`.
     */

    use(handler: RequestHandler, ...more: RequestHandler[]): RequestHandler {
        let {_for, _error} = this;

        if (more.length) {
            handler = ASYNC(handler, ASYNC.apply(null, more));
        } else {
            handler = ASYNC(handler);
        }

        if (_for) handler = IF(_for, handler);

        if (_error) handler = ASYNC(handler, CATCH(_error));

        return handler;
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

    if(condition: (res: Response) => (boolean | Promise<boolean>)): this {
        this._if = AND<Response>(this._if, condition);
        return this;
    }

    _if: ((res: Response) => (boolean | Promise<boolean>));

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
            if (encoding) {
                res.setHeader("Content-Encoding", encoding); // signal to compress with the encoding
            }
            return buf;
        });
    }

    decompressResponse(): RequestHandler {
        return this.replaceBuffer((buf, req, res) => {
            res.removeHeader("Content-Encoding"); // signal NOT to compress
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
    if (!A) return B;
    if (!B) return A;

    return (arg: T) => {
        let result = A(arg);
        // result: false
        if (!result) return false;
        // result: true
        if (!isThenable(result as Promise<boolean>)) return B(arg);
        // result: Promise<boolean>
        return (result as Promise<boolean>).then(result => (result && B(arg)));
    };
}

const isThenable = <T>(value: Promise<T>): boolean => ("function" === typeof (value.then));
