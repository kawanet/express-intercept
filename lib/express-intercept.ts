// express-intercept.ts

import {Request, RequestHandler, Response} from "express";
import {Duplex} from "stream";
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

interface IWritable {
    write(chunk: any, encoding?: string, cb?: CallbackFn): boolean;

    end(chunk?: any, encoding?: string, cb?: CallbackFn): void;
}

interface IDuplex extends IWritable {
    pipe(destination: IWritable): any;
}

export const requestHandler = () => new RequestHandlerBuilder();

export const responseHandler = () => new ResponseHandlerBuilder();

const TRUE = () => true;

class RequestHandlerBuilder {
    private _for = TRUE as ((req: Request) => boolean);

    for(condition: (req: Request) => boolean): this {
        if (condition) this._for = AND<Request>(this._for, condition);
        return this;
    }

    use(handler: RequestHandler, ...more: RequestHandler[]): RequestHandler {
        for (const mw of more) {
            handler = (handler && mw) ? JOIN(handler, mw) : (handler || mw);
        }

        // NOP
        if (!handler) handler = (req, res, next) => next();

        let _for = this._for;
        if (!_for) return handler;

        return (req, res, next) => {
            Promise.resolve().then(() => _for(req)).then(ok => (ok ? handler(req, res, next) : next()), next);
        };
    }

    getRequest(receiver: (req: Request) => (any | void)): RequestHandler {
        return (req, res, next) => {
            Promise.resolve().then(() => receiver(req)).then(() => next(), next);
        }
    }
}

class ResponseHandlerBuilder extends RequestHandlerBuilder {
    private _if = TRUE as ((res: Response) => boolean);
    use: never;

    if(condition: (res: Response) => boolean): this {
        if (condition) this._if = AND<Response>(this._if, condition);
        return this;
    }

    replaceString(replacer: (body: string, req?: Request, res?: Response) => (string | Promise<string>)): RequestHandler {
        return super.use(transformResponse(this._if, interceptStream(async (payload, req, res) => {
            let body = payload.getString();
            body = await replacer(body, req, res);
            payload.setString(body);
        })));
    }

    replaceBuffer(replacer: (body: Buffer, req?: Request, res?: Response) => (Buffer | Promise<Buffer>)): RequestHandler {
        return super.use(transformResponse(this._if, interceptStream(async (payload, req, res) => {
            let body = payload.getBuffer();
            body = await replacer(body, req, res);
            payload.setBuffer(body);
        })));
    }

    getString(receiver: (body: string, req?: Request, res?: Response) => (void | Promise<void>)): RequestHandler {
        return super.use(transformResponse(this._if, interceptStream(async (payload, req, res) => {
            const body = payload.getString();
            await receiver(body, req, res);
        })));
    }

    getBuffer(receiver: (body: Buffer, req?: Request, res?: Response) => (void | Promise<void>)): RequestHandler {
        return super.use(transformResponse(this._if, interceptStream(async (payload, req, res) => {
            const body = payload.getBuffer();
            await receiver(body, req, res);
        })));
    }

    getRequest(receiver: (req: Request) => (any | void)): RequestHandler {
        return super.use(transformResponse(this._if, (req, res) => {
            receiver(req);
        }));
    }

    getResponse(receiver: (res: Response) => (any | void)): RequestHandler {
        return super.use(transformResponse(this._if, (req, res) => {
            receiver(res);
        }));
    }

    transformStream(transformer: (req: Request, res: Response) => Duplex): RequestHandler {
        return super.use(transformResponse(this._if, interceptStream(async (payload, req, res) => {
            const stream = transformer(req, res);
            if (!stream) return;
            stream.pipe(res);
            return stream;
        })));
    }
}

function interceptStream(onEnd: (payload: ResponsePayload, req: Request, res: Response) => (Promise<IWritable> | Promise<void>)): (req: Request, res: Response) => IDuplex {
    return (req, res) => {
        const payload = new ResponsePayload(res);

        payload.onEnd = function () {
            return onEnd(this, req, res);
        }

        return payload;
    };
}

function transformResponse(_if: ((res: Response) => boolean), interceptor: (req: Request, res: Response) => (IDuplex | void)): RequestHandler {
    return interceptResponse((req, res) => {
        if (!_if(res)) return;

        return interceptor(req, res);
    });
}

function interceptResponse(interceptor: (req: Request, res: Response) => (IDuplex | void)): RequestHandler {
    return (req, res, next) => {
        let original: IWritable = {write: res.write, end: res.end};
        let stream: IWritable;
        let started: boolean;
        let closed: boolean;

        const _write = res.write = function (chunk: any, encoding?: any, cb?: CallbackFn) {
            if (!started) start();

            if (stream) {
                return stream.write.apply(stream, arguments);
            } else {
                return original.write.apply(this, arguments);
            }
        };

        const _end = res.end = function (chunk?: any, encoding?: any, cb?: CallbackFn) {
            if (!started) start();
            const s = stream;
            if (!closed) close();

            if (s) {
                return s.end.apply(s, arguments);
            } else {
                return original.end.apply(this, arguments);
            }
        };

        next();

        function start() {
            started = true;
            if (interceptor) stream = interceptor(req, res) || null;
            if (!stream) close();
        }

        function close() {
            closed = true;
            stream = null;
            if (res.write === _write) res.write = original.write as any;
            if (res.end === _end) res.end = original.end as any;
        }
    };
}

class ResponsePayload implements IWritable {
    private queue: ChunkItem[] = [];

    onEnd: () => Promise<IWritable | void>;

    constructor(private res: Response) {
        //
    }

    write(chunk: any, encoding?: any, cb?: CallbackFn) {
        const item = [].slice.call(arguments);
        if ("function" === typeof item[item.length - 1]) cb = item.pop();
        if (item[0]) this.queue.push(item);
        if (cb) cb();
        return true;
    }

    end(chunk?: any, encoding?: any, cb?: CallbackFn) {
        const item = [].slice.call(arguments);
        if ("function" === typeof item[item.length - 1]) cb = item.pop();
        if (item[0]) this.queue.push(item);
        if (!cb) cb = () => null;
        Promise.resolve().then(() => {
            if (this.onEnd) return this.onEnd();
        }).then(stream => this.pipe(stream || this.res)).then(() => cb(), cb);
    }

    async pipe(stream: IWritable): Promise<IWritable> {
        const {queue} = this;
        let error: Error;
        const catchError = (e: Error) => (error = (error || e));

        queue.forEach(item => {
            if (!error) stream.write(item[0], item[1], catchError);
        });

        await stream.end(catchError);

        if (error) return Promise.reject(error);

        return stream;
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
    return (arg: T) => A(arg) && B(arg);
}

function JOIN(a: RequestHandler, b: RequestHandler): RequestHandler {
    return (req, res, next) => a(req, res, err => (err ? next(err) : b(req, res, next)));
}
