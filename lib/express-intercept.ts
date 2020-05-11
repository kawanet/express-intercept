// express-intercept.ts

import {Request, RequestHandler, Response} from "express";
import {Duplex, Writable} from "stream";
import * as zlib from "zlib";

type CallbackFn = (err?: Error) => void;
type ChunkItem = [string | Buffer, any?, any?];
type CondFn<T> = (arg: T) => boolean;

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

    for(condition: (req: Request) => boolean): this {
        this._for = (this._for && condition) ? AND<Request>(this._for, condition) : (this._for || condition);
        return this;
    }

    use(handler: RequestHandler, ...more: RequestHandler[]): RequestHandler {
        for (const mw of more) {
            handler = (handler && mw) ? JOIN(handler, mw) : (handler || mw);
        }

        // NOP
        if (!handler) handler = (req, res, next) => next();

        return buildRequestHandler(this._for, handler);
    }

    getRequest(receiver: (req: Request) => (any | void)): RequestHandler {
        return (req, res, next) => {
            return Promise.resolve().then(() => receiver(req)).then(() => next(), next);
        }
    }
}

class ResponseHandlerBuilder extends RequestHandlerBuilder {
    private _if: ((res: Response) => boolean);
    use: never;

    if(condition: (res: Response) => boolean): this {
        this._if = (this._if && condition) ? AND<Response>(this._if, condition) : (this._if || condition);
        return this;
    }

    replaceString(replacer: (body: string, req?: Request, res?: Response) => (string | Promise<string>)): RequestHandler {
        return super.use(buildResponseHandler(this._if, async (payload, req, res) => {
            let body = payload.getString();
            body = await replacer(body, req, res);
            payload.setString(body);
        }));
    }

    replaceBuffer(replacer: (body: Buffer, req?: Request, res?: Response) => (Buffer | Promise<Buffer>)): RequestHandler {
        return super.use(buildResponseHandler(this._if, async (payload, req, res) => {
            let body = payload.getBuffer();
            body = await replacer(body, req, res);
            payload.setBuffer(body);
        }));
    }

    getString(receiver: (body: string, req?: Request, res?: Response) => (void | Promise<void>)): RequestHandler {
        return super.use(buildResponseHandler(this._if, async (payload, req, res) => {
            const body = payload.getString();
            await receiver(body, req, res);
        }));
    }

    getBuffer(receiver: (body: Buffer, req?: Request, res?: Response) => (void | Promise<void>)): RequestHandler {
        return super.use(buildResponseHandler(this._if, async (payload, req, res) => {
            const body = payload.getBuffer();
            await receiver(body, req, res);
        }));
    }

    getRequest(receiver: (req: Request) => (any | void)): RequestHandler {
        return super.use(buildResponseHandler(this._if, async (payload, req, res) => {
            receiver(req);
        }));
    }

    getResponse(receiver: (res: Response) => (any | void)): RequestHandler {
        return super.use(buildResponseHandler(this._if, async (payload, req, res) => {
            receiver(res);
        }));
    }

    transformStream(interceptor: (req: Request, res: Response) => Duplex): RequestHandler {
        return super.use(buildResponseHandler(this._if, async (payload, req, res) => {
            const stream = interceptor(req, res);
            if (!stream) return;
            stream.pipe(res);
            return stream;
        }));
    }
}

function buildRequestHandler(_for: ((req: Request) => boolean), handler: RequestHandler): RequestHandler {
    // without _for condition
    if (!_for) return handler;

    // with _for condition
    return (req, res, next) => {
        return _for(req) ? handler(req, res, next) : next();
    };
}

function buildResponseHandler(_if: (res: Response) => boolean, interceptor?: (payload: ResponsePayload, req: Request, res: Response) => (Promise<Writable | void>)): RequestHandler {
    return (req, res, next) => {
        const queue = [] as ChunkItem[];
        let started: boolean;
        let stopped: boolean;
        let error: boolean;

        const original_write = res.write;
        const intercept_write = res.write = function (chunk: any, encoding?: any, cb?: CallbackFn) {
            if (!started) start();
            if (stopped) return original_write.apply(this, arguments);

            const item = [].slice.call(arguments);
            if ("function" === typeof item[item.length - 1]) cb = item.pop();
            if (item[0]) queue.push(item);
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
            if (item[0]) queue.push(item);
            finish(cb);
            return this;
        };

        return next();

        function start() {
            started = true;

            try {
                if (_if && !_if(res)) return stop();
            } catch (e) {
                error = true;
            }
        }

        function stop() {
            stopped = true;

            // restore to the original methods
            if (res.write === intercept_write) res.write = original_write;
            if (res.end === intercept_end) res.end = original_end;
        }

        async function finish(cb: CallbackFn) {
            const payload = new ResponsePayload(res, queue);
            let dest: Writable;

            try {
                if (!error && interceptor) dest = await interceptor(payload, req, res) || null;
            } catch (e) {
                error = true;
            }

            if (error) {
                res.status(500);
                payload.setBuffer(Buffer.of()); // empty
                res.end();
            } else {
                send(payload.queue, (dest || res), cb);
            }
        }
    };
}

function send(queue: ChunkItem[], dest: Writable, cb: CallbackFn) {
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
    private res: Response;
    queue: ChunkItem[];

    constructor(res: Response, queue?: ChunkItem[]) {
        this.res = res;
        this.queue = queue || [];
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

/**
 * @private
 */

function AND<T>(A: CondFn<T>, B: CondFn<T>): CondFn<T> {
    return (arg: T) => (A(arg) && B(arg));
}

function JOIN(A: RequestHandler, B: RequestHandler): RequestHandler {
    return (req, res, next) => A(req, res, err => (err ? next(err) : B(req, res, next)));
}
