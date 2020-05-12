// express-intercept.ts

import {Request, RequestHandler, Response} from "express";
import {Readable, Writable} from "stream";
import * as zlib from "zlib";

type CallbackFn = (err?: Error) => void;
type ChunkItem = [string | Buffer, any?, any?];
type CondFn<T> = (arg: T) => boolean;

interface IReadable {
    push: (chunk: any, encoding?: string) => void;
    pipe: (destination: Writable) => Writable;
}

const decoders = {
    br: zlib.brotliDecompressSync,
    gzip: zlib.gunzipSync,
    deflate: zlib.inflateSync,
} as { [encoding: string]: (buf: Buffer) => Buffer };

const encoders = {
    br: zlib.brotliCompressSync,
    gzip: zlib.gzipSync,
    deflate: zlib.deflateSync,
} as { [encoding: string]: (buf: Buffer) => Buffer };

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
     * It manages the response stream even when chunked or compressed.
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
     * It manages the response stream even when chunked or compressed.
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
     * It passes raw response as a stream.Readable whether compressed or not.
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
     * It manages the response stream even when chunked or compressed.
     */

    getString(receiver: (body: string, req?: Request, res?: Response) => (any | Promise<any>)): RequestHandler {
        return super.use(buildResponseHandler<ResponsePayload>(this._if, async (payload, req, res) => {
            const body = payload.getString();
            await receiver(body, req, res);
        }));
    }

    /**
     * It returns a RequestHandler to retrieve the response content body as a Buffer.
     * It manages the response stream even when chunked or compressed.
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

function buildRequestHandler(requestFor: ((req: Request) => boolean), handler: RequestHandler): RequestHandler {
    // without .for() condition
    if (!requestFor) return handler;

    // with .for() condition
    return (req, res, next) => requestFor(req) ? handler(req, res, next) : next();
}

function buildResponseHandler<T extends IReadable>(
    responseIf: (res: Response) => boolean,
    interceptor?: (payload: T, req: Request, res: Response) => (Promise<T | void>),
    container?: () => T
): RequestHandler {
    return (req, res, next) => {
        let started: boolean;
        let stopped: boolean;
        let payload: IReadable;
        let error: Error;

        const original_write = res.write;
        const intercept_write = res.write = function (chunk: any, encoding?: any, cb?: CallbackFn) {
            if (!started) start();
            if (stopped) return original_write.apply(this, arguments);

            const item = [].slice.call(arguments);
            if ("function" === typeof item[item.length - 1]) cb = item.pop();
            if (item[0]) payload.push(item[0], item[1]);
            if (cb) cb(); // received
            return true;
        };

        const original_end = res.end;
        const intercept_end = res.end = function (chunk?: any, encoding?: any, cb?: CallbackFn) {
            if (!started) start();
            const _stopped = stopped;
            if (!stopped) stop();
            if (_stopped) return original_end.apply(this, arguments);

            const item = [].slice.call(arguments);
            if ("function" === typeof item[item.length - 1]) cb = item.pop();
            if (item[0]) payload.push(item[0], item[1]);
            if (!cb) cb = (e?: Error) => null;
            payload.push(null);
            finish().then(() => cb(), cb);
            return this;
        };

        return next();

        function start() {
            started = true;

            try {
                if (responseIf && !responseIf(res)) return stop(); // .if()
            } catch (e) {
                error = e;
            }

            payload = container ? container() : new ResponsePayload(res) as IReadable;
        }

        function stop() {
            stopped = true;

            // restore to the original methods
            if (res.write === intercept_write) res.write = original_write;
            if (res.end === intercept_end) res.end = original_end;
        }

        async function finish() {
            let readable: IReadable;

            try {
                if (!error && interceptor) {
                    readable = await interceptor(payload as T, req, res) || payload;
                }
            } catch (e) {
                error = e;
            }

            // change response status code if failed before sending body
            if (error) {
                res.status(500);
                res.end();
                return Promise.reject(error);
            }

            readable.pipe(res);
        }
    };
}

function send(queue: ChunkItem[], dest: Writable, cb?: CallbackFn) {
    let error: Error;

    try {
        queue.forEach(item => {
            if (!error) dest.write(item[0], item[1], catchError);
        });
    } catch (e) {
        catchError(e);
    }

    // close stream even on error
    try {
        dest.end(sendResult);
    } catch (e) {
        catchError(e);
    }

    if (cb) cb(); // success callback

    function catchError(e: Error) {
        error = error || e;
    }

    function sendResult(e: Error) {
        if (cb) cb(e || error);
        cb = null; // callback only once
    }
}

class ResponsePayload {
    queue: ChunkItem[] = [];

    constructor(private res: Response) {
        //
    }

    push(chunk: any, encoding?: string): void {
        if (chunk == null) return; // EOF
        this.queue.push([chunk, encoding]);
    }

    pipe(destination: Writable): Writable {
        send(this.queue, destination);
        return destination;
    }

    getBuffer(): Buffer {
        const {queue, res} = this;

        // force Buffer
        const buffers = queue.map(item => item[0]).map(chunk => Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));

        // concat Buffer
        let buffer = Buffer.concat(buffers);

        // uncompress Buffer
        const contentEncoding = res.getHeader("Content-Encoding") as string;
        const transferEncoding = res.getHeader("Transfer-Encoding") as string;
        const decoder = decoders[contentEncoding] || decoders[transferEncoding];

        if (decoder && buffer.length) {
            buffer = decoder(buffer);
        }

        return buffer;
    }

    setBuffer(buffer: Buffer) {
        const {queue, res} = this;
        if (!buffer) buffer = Buffer.of();

        // ETag:
        var etagFn = res.app && res.app.get('etag fn')
        if ("function" === typeof etagFn) {
            res.setHeader("ETag", etagFn(buffer));
        } else {
            res.removeHeader("ETag");
        }

        // compress Buffer as before
        const contentEncoding = res.getHeader("Content-Encoding") as string;
        const transferEncoding = res.getHeader("Transfer-Encoding") as string;
        const encoder = encoders[contentEncoding] || encoders[transferEncoding];

        if (encoder && buffer.length) {
            buffer = encoder(buffer);
        }

        const length = +buffer.length;
        if (length) {
            res.setHeader("Content-Length", "" + length);
        } else {
            res.removeHeader("Content-Length");
        }

        // empty
        queue.splice(0);

        // update
        queue.push([buffer]);
    }

    getString(): string {
        const {queue} = this;

        // shortcut when only string chunks given and no Buffer chunks mixed
        const stringOnly = !queue.filter(chunk => "string" !== typeof chunk[0]).length;
        if (stringOnly) return queue.map(item => item[0]).join("");

        const buffer = this.getBuffer();

        // Buffer to string
        return buffer.toString();
    }

    setString(text: string) {
        if (!text) text = "";
        const buffer = Buffer.from(text);
        this.setBuffer(buffer);
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
