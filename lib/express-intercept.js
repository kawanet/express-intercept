"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const stream_1 = require("stream");
const _handler_1 = require("./_handler");
const _compression_1 = require("./_compression");
const NOP = (req, res, next) => next();
function requestHandler(errorHandler) {
    return new RequestHandlerBuilder(errorHandler || defaultErrorHandler);
}
exports.requestHandler = requestHandler;
function responseHandler(errorHandler) {
    return new ResponseHandlerBuilder(errorHandler || defaultErrorHandler);
}
exports.responseHandler = responseHandler;
const defaultErrorHandler = (err, req, res, next) => {
    console.error(err);
    res.status(500).set({ "Content-Length": "0" }).end();
};
class RequestHandlerBuilder {
    constructor(errorHandler) {
        this._error = errorHandler;
    }
    for(condition) {
        this._for = (this._for && condition) ? AND(this._for, condition) : (this._for || condition);
        return this;
    }
    use(handler, ...more) {
        for (const mw of more) {
            if (mw)
                handler = handler ? JOIN(handler, mw) : mw;
        }
        if (!handler)
            handler = NOP;
        if (this._for)
            handler = IF(this._for, handler);
        return asyncHandler(handler, this._error);
    }
    getRequest(receiver) {
        return this.use(async (req, res, next) => {
            await receiver(req);
            next();
        });
    }
}
class ResponseHandlerBuilder extends RequestHandlerBuilder {
    if(condition) {
        this._if = (this._if && condition) ? AND(this._if, condition) : (this._if || condition);
        return this;
    }
    replaceString(replacer) {
        return super.use(_handler_1.buildResponseHandler(this, async (payload, req, res) => {
            const body = payload.getString();
            const replaced = await replacer(body, req, res);
            if (body === replaced)
                return;
            payload.setString(replaced);
        }));
    }
    replaceBuffer(replacer) {
        return super.use(_handler_1.buildResponseHandler(this, async (payload, req, res) => {
            let body = payload.getBuffer();
            body = await replacer(body, req, res);
            payload.setBuffer(body);
        }));
    }
    interceptStream(interceptor) {
        return super.use(_handler_1.buildResponseHandler(this, async (payload, req, res) => {
            return interceptor(payload, req, res);
        }, () => new ReadablePayload()));
    }
    getString(receiver) {
        return super.use(_handler_1.buildResponseHandler(this, async (payload, req, res) => {
            const body = payload.getString();
            await receiver(body, req, res);
        }));
    }
    getBuffer(receiver) {
        return super.use(_handler_1.buildResponseHandler(this, async (payload, req, res) => {
            const body = payload.getBuffer();
            await receiver(body, req, res);
        }));
    }
    getRequest(receiver) {
        return super.use(_handler_1.buildResponseHandler(this, async (payload, req, res) => {
            await receiver(req);
        }));
    }
    getResponse(receiver) {
        return super.use(_handler_1.buildResponseHandler(this, async (payload, req, res) => {
            await receiver(res);
        }));
    }
    compressResponse() {
        return this.replaceBuffer((buf, req, res) => {
            const encoding = _compression_1.findEncoding(req.header("Accept-Encoding"));
            res.setHeader("Content-Encoding", encoding);
            return buf;
        });
    }
    decompressResponse() {
        return this.replaceBuffer((buf, req, res) => {
            res.removeHeader("Content-Encoding");
            return buf;
        });
    }
}
class ReadablePayload extends stream_1.Readable {
    _read() {
    }
}
function AND(A, B) {
    return (arg) => (A(arg) && B(arg));
}
function IF(tester, handler) {
    return (req, res, next) => tester(req) ? handler(req, res, next) : next();
}
function JOIN(A, B) {
    return (req, res, next) => A(req, res, err => (err ? next(err) : B(req, res, next)));
}
function asyncHandler(handler, errorHandler) {
    return async (req, res, next) => {
        try {
            return await handler(req, res, cb);
        }
        catch (err) {
            return cb(err);
        }
        function cb(err) {
            if (!next)
                return;
            const _next = next;
            next = null;
            if (err && errorHandler) {
                return errorHandler(err, req, res, _next);
            }
            else {
                return _next(err);
            }
        }
    };
}
