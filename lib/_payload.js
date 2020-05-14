"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const _compression_1 = require("./_compression");
function send(queue, dest, cb) {
    let error;
    if (queue.length === 1) {
        const item = queue[0];
        try {
            dest.end(item[0], item[1], sendResult);
        }
        catch (e) {
            catchError(e);
        }
    }
    else {
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
        const buffers = queue.map(item => Buffer.isBuffer(item[0]) ? item[0] : Buffer.from(item[0], item[1]));
        let buffer = (buffers.length === 1) ? buffers[0] : Buffer.concat(buffers);
        const encoding = _compression_1.findEncoding(res.getHeader("Content-Encoding"));
        if (encoding && buffer.length) {
            buffer = _compression_1.decompressBuffer(buffer, encoding);
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
        const encoding = _compression_1.findEncoding(res.getHeader("Content-Encoding"));
        if (encoding && buffer.length) {
            buffer = _compression_1.compressBuffer(buffer, encoding);
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
