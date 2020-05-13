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
    constructor(res) {
        this.res = res;
        this.queue = [];
    }
    push(chunk, encoding) {
        if (chunk == null)
            return;
        this.queue.push([chunk, encoding]);
    }
    pipe(destination) {
        send(this.queue, destination);
        return destination;
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
exports.ResponsePayload = ResponsePayload;
