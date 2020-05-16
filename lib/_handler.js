"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const _payload_1 = require("./_payload");
function buildResponseHandler(options, interceptor, container) {
    const { _error, _if } = options || {};
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
            if (payload && item[0])
                payload.push(item[0], item[1]);
            if (cb)
                cb();
            return true;
        };
        const original_end = res.end;
        const intercept_end = res.end = function (chunk, encoding, cb) {
            if (!stopped && !started)
                start();
            const _stopped = stopped;
            if (!stopped)
                stop();
            if (_stopped)
                return original_end.apply(this, arguments);
            const item = [].slice.call(arguments);
            if ("function" === typeof item[item.length - 1])
                cb = item.pop();
            if (payload && item[0])
                payload.push(item[0], item[1]);
            if (payload)
                payload.push(null);
            if (cb)
                cb();
            if (error)
                sendError(error);
            if (!error)
                finish().catch(sendError);
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
                error = e;
                return;
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
            const readable = interceptor && await interceptor(payload, req, res) || payload;
            readable.pipe(res);
        }
        function sendError(err) {
            if (_error)
                _error(err, req, res, (e) => null);
        }
    };
}
exports.buildResponseHandler = buildResponseHandler;
