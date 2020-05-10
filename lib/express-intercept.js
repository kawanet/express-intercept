"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const zlib = require("zlib");
const decoders = {
    br: zlib.brotliDecompressSync,
    gzip: zlib.gunzipSync,
    deflate: zlib.inflateSync,
};
const encoders = {
    br: zlib.brotliCompressSync,
    gzip: zlib.gzipSync,
    deflate: zlib.deflateSync,
};
exports.requestHandler = () => new RequestHandlerBuilder();
exports.responseHandler = () => new ResponseHandlerBuilder();
const TRUE = () => true;
class RequestHandlerBuilder {
    constructor() {
        this._for = TRUE;
    }
    for(condition) {
        if (condition)
            this._for = AND(this._for, condition);
        return this;
    }
    use(handler, ...more) {
        for (const mw of more) {
            handler = (handler && mw) ? JOIN(handler, mw) : (handler || mw);
        }
        if (!handler)
            handler = (req, res, next) => next();
        let _for = this._for;
        if (!_for)
            return handler;
        return (req, res, next) => {
            Promise.resolve().then(() => _for(req)).then(ok => (ok ? handler(req, res, next) : next()), next);
        };
    }
    getRequest(receiver) {
        return (req, res, next) => {
            Promise.resolve().then(() => receiver(req)).then(() => next(), next);
        };
    }
}
class ResponseHandlerBuilder extends RequestHandlerBuilder {
    constructor() {
        super(...arguments);
        this._if = TRUE;
    }
    if(condition) {
        if (condition)
            this._if = AND(this._if, condition);
        return this;
    }
    replaceString(replacer) {
        return super.use(transformResponse(this._if, interceptStream(async (payload, req, res) => {
            let body = payload.getString();
            body = await replacer(body, req, res);
            payload.setString(body);
        })));
    }
    replaceBuffer(replacer) {
        return super.use(transformResponse(this._if, interceptStream(async (payload, req, res) => {
            let body = payload.getBuffer();
            body = await replacer(body, req, res);
            payload.setBuffer(body);
        })));
    }
    getString(receiver) {
        return super.use(transformResponse(this._if, interceptStream(async (payload, req, res) => {
            const body = payload.getString();
            await receiver(body, req, res);
        })));
    }
    getBuffer(receiver) {
        return super.use(transformResponse(this._if, interceptStream(async (payload, req, res) => {
            const body = payload.getBuffer();
            await receiver(body, req, res);
        })));
    }
    getRequest(receiver) {
        return super.use(transformResponse(this._if, (req, res) => {
            receiver(req);
        }));
    }
    getResponse(receiver) {
        return super.use(transformResponse(this._if, (req, res) => {
            receiver(res);
        }));
    }
    transformStream(transformer) {
        return super.use(transformResponse(this._if, interceptStream(async (payload, req, res) => {
            const stream = transformer(req, res);
            if (!stream)
                return;
            stream.pipe(res);
            return stream;
        })));
    }
}
function interceptStream(onEnd) {
    return (req, res) => {
        const payload = new ResponsePayload(res);
        payload.onEnd = function () {
            return onEnd(this, req, res);
        };
        return payload;
    };
}
function transformResponse(_if, interceptor) {
    return interceptResponse((req, res) => {
        if (!_if(res))
            return;
        return interceptor(req, res);
    });
}
function interceptResponse(interceptor) {
    return (req, res, next) => {
        let original = { write: res.write, end: res.end };
        let stream;
        let started;
        let closed;
        const _write = res.write = function (chunk, encoding, cb) {
            if (!started)
                start();
            if (stream) {
                return stream.write.apply(stream, arguments);
            }
            else {
                return original.write.apply(this, arguments);
            }
        };
        const _end = res.end = function (chunk, encoding, cb) {
            if (!started)
                start();
            const s = stream;
            if (!closed)
                close();
            if (s) {
                return s.end.apply(s, arguments);
            }
            else {
                return original.end.apply(this, arguments);
            }
        };
        next();
        function start() {
            started = true;
            if (interceptor)
                stream = interceptor(req, res) || null;
            if (!stream)
                close();
        }
        function close() {
            closed = true;
            stream = null;
            if (res.write === _write)
                res.write = original.write;
            if (res.end === _end)
                res.end = original.end;
        }
    };
}
class ResponsePayload {
    constructor(res) {
        this.res = res;
        this.queue = [];
    }
    write(chunk, encoding, cb) {
        const item = [].slice.call(arguments);
        if ("function" === typeof item[item.length - 1])
            cb = item.pop();
        if (item[0])
            this.queue.push(item);
        if (cb)
            cb();
        return true;
    }
    end(chunk, encoding, cb) {
        const item = [].slice.call(arguments);
        if ("function" === typeof item[item.length - 1])
            cb = item.pop();
        if (item[0])
            this.queue.push(item);
        if (!cb)
            cb = () => null;
        Promise.resolve().then(() => {
            if (this.onEnd)
                return this.onEnd();
        }).then(stream => this.pipe(stream || this.res)).then(() => cb(), cb);
    }
    async pipe(stream) {
        const { queue } = this;
        let error;
        const catchError = (e) => (error = (error || e));
        queue.forEach(item => {
            if (!error)
                stream.write(item[0], item[1], catchError);
        });
        await stream.end(catchError);
        if (error)
            return Promise.reject(error);
        return stream;
    }
    getBuffer() {
        const { queue, res } = this;
        const buffers = queue.map(item => item[0]).map(chunk => Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        let buffer = Buffer.concat(buffers);
        const contentEncoding = res.getHeader("Content-Encoding");
        const transferEncoding = res.getHeader("Transfer-Encoding");
        const decoder = decoders[contentEncoding] || decoders[transferEncoding];
        if (decoder && buffer.length) {
            buffer = decoder(buffer);
        }
        return buffer;
    }
    setBuffer(buffer) {
        const { queue, res } = this;
        if (!buffer)
            buffer = Buffer.of();
        var etagFn = res.app && res.app.get('etag fn');
        if ("function" === typeof etagFn) {
            res.setHeader("ETag", etagFn(buffer));
        }
        else {
            res.removeHeader("ETag");
        }
        const contentEncoding = res.getHeader("Content-Encoding");
        const transferEncoding = res.getHeader("Transfer-Encoding");
        const encoder = encoders[contentEncoding] || encoders[transferEncoding];
        if (encoder && buffer.length) {
            buffer = encoder(buffer);
        }
        const length = +buffer.length;
        if (length) {
            res.setHeader("Content-Length", "" + length);
        }
        else {
            res.removeHeader("Content-Length");
        }
        queue.splice(0);
        queue.push([buffer]);
    }
    getString() {
        const { queue } = this;
        const stringOnly = !queue.filter(chunk => "string" !== typeof chunk[0]).length;
        if (stringOnly)
            return queue.map(item => item[0]).join("");
        const buffer = this.getBuffer();
        return buffer.toString();
    }
    setString(text) {
        if (!text)
            text = "";
        const buffer = Buffer.from(text);
        this.setBuffer(buffer);
    }
}
function AND(A, B) {
    return (arg) => A(arg) && B(arg);
}
function JOIN(a, b) {
    return (req, res, next) => a(req, res, err => (err ? next(err) : b(req, res, next)));
}
