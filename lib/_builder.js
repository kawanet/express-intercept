"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const _payload_1 = require("./_payload");
function buildRequestHandler(requestFor, handler) {
    if (!requestFor)
        return handler;
    return (req, res, next) => requestFor(req) ? handler(req, res, next) : next();
}
exports.buildRequestHandler = buildRequestHandler;
function buildResponseHandler(responseIf, interceptor, container) {
    return (req, res, next) => {
        let started;
        let stopped;
        let payload;
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
                payload.push(item[0], item[1]);
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
                payload.push(item[0], item[1]);
            if (!cb)
                cb = (e) => null;
            payload.push(null);
            finish().then(() => cb(), cb);
            return this;
        };
        return next();
        function start() {
            started = true;
            try {
                if (responseIf && !responseIf(res))
                    return stop();
            }
            catch (e) {
                error = e;
            }
            payload = container ? container() : new _payload_1.ResponsePayload(res);
        }
        function stop() {
            stopped = true;
            if (res.write === intercept_write)
                res.write = original_write;
            if (res.end === intercept_end)
                res.end = original_end;
        }
        async function finish() {
            let readable;
            try {
                if (!error && interceptor) {
                    readable = await interceptor(payload, req, res) || payload;
                }
            }
            catch (e) {
                error = e;
            }
            if (error) {
                res.status(500);
                res.end();
                return Promise.reject(error);
            }
            readable.pipe(res);
        }
    };
}
exports.buildResponseHandler = buildResponseHandler;
