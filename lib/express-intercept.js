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
class RequestHandlerBuilder {
    for(condition) {
        this._for = (this._for && condition) ? AND(this._for, condition) : (this._for || condition);
        return this;
    }
    use(handler, ...more) {
        for (const mw of more) {
            handler = (handler && mw) ? JOIN(handler, mw) : (handler || mw);
        }
        if (!handler)
            handler = (req, res, next) => next();
        return buildRequestHandler(this._for, handler);
    }
    getRequest(receiver) {
        return (req, res, next) => {
            return Promise.resolve().then(() => receiver(req)).then(() => next(), next);
        };
    }
}
class ResponseHandlerBuilder extends RequestHandlerBuilder {
    if(condition) {
        this._if = (this._if && condition) ? AND(this._if, condition) : (this._if || condition);
        return this;
    }
    replaceString(replacer) {
        return super.use(buildResponseHandler(this._if, async (payload, req, res) => {
            let body = payload.getString();
            body = await replacer(body, req, res);
            payload.setString(body);
        }));
    }
    replaceBuffer(replacer) {
        return super.use(buildResponseHandler(this._if, async (payload, req, res) => {
            let body = payload.getBuffer();
            body = await replacer(body, req, res);
            payload.setBuffer(body);
        }));
    }
    getString(receiver) {
        return super.use(buildResponseHandler(this._if, async (payload, req, res) => {
            const body = payload.getString();
            await receiver(body, req, res);
        }));
    }
    getBuffer(receiver) {
        return super.use(buildResponseHandler(this._if, async (payload, req, res) => {
            const body = payload.getBuffer();
            await receiver(body, req, res);
        }));
    }
    getRequest(receiver) {
        return super.use(buildResponseHandler(this._if, async (payload, req, res) => {
            await receiver(req);
        }));
    }
    getResponse(receiver) {
        return super.use(buildResponseHandler(this._if, async (payload, req, res) => {
            await receiver(res);
        }));
    }
    transformStream(interceptor) {
        return super.use(buildResponseHandler(this._if, async (payload, req, res) => {
            const stream = await interceptor(req, res);
            if (!stream)
                return;
            stream.pipe(res);
            return stream;
        }));
    }
}
function buildRequestHandler(_for, handler) {
    if (!_for)
        return handler;
    return (req, res, next) => {
        return _for(req) ? handler(req, res, next) : next();
    };
}
function buildResponseHandler(_if, interceptor) {
    return (req, res, next) => {
        const queue = [];
        let started;
        let stopped;
        let error;
        const original_write = res.write;
        const intercept_write = res.write = function (chunk, encoding, cb) {
            if (!started)
                start();
            if (stopped)
                return original_write.apply(this, arguments);
            const item = [].slice.call(arguments);
            if ("function" === typeof item[item.length - 1])
                cb = item.pop();
            if (item[0])
                queue.push(item);
            if (cb)
                cb();
            return true;
        };
        const original_end = res.end;
        const intercept_end = res.end = function (chunk, encoding, cb) {
            if (!started)
                start();
            const _stopped = stopped;
            if (!stopped)
                stop();
            if (_stopped)
                return original_end.apply(this, arguments);
            const item = [].slice.call(arguments);
            if ("function" === typeof item[item.length - 1])
                cb = item.pop();
            if (item[0])
                queue.push(item);
            finish(cb);
            return this;
        };
        return next();
        function start() {
            started = true;
            try {
                if (_if && !_if(res))
                    return stop();
            }
            catch (e) {
                error = true;
            }
        }
        function stop() {
            stopped = true;
            if (res.write === intercept_write)
                res.write = original_write;
            if (res.end === intercept_end)
                res.end = original_end;
        }
        async function finish(cb) {
            const payload = new ResponsePayload(res, queue);
            let dest;
            try {
                if (!error && interceptor)
                    dest = await interceptor(payload, req, res) || null;
            }
            catch (e) {
                error = true;
            }
            if (error) {
                res.status(500);
                payload.setBuffer(Buffer.of());
                res.end();
            }
            else {
                send(payload.queue, (dest || res), cb);
            }
        }
    };
}
function send(queue, dest, cb) {
    let error;
    try {
        queue.forEach(item => {
            if (!error)
                dest.write(item[0], item[1], catchError);
        });
    }
    catch (e) {
        catchError(e);
    }
    try {
        dest.end(sendResult);
    }
    catch (e) {
        catchError(e);
    }
    if (cb)
        cb();
    function catchError(e) {
        error = error || e;
    }
    function sendResult(e) {
        if (cb)
            cb(e || error);
        cb = null;
    }
}
class ResponsePayload {
    constructor(res, queue) {
        this.res = res;
        this.queue = queue || [];
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
    return (arg) => (A(arg) && B(arg));
}
function JOIN(A, B) {
    return (req, res, next) => A(req, res, err => (err ? next(err) : B(req, res, next)));
}
