"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const stream_1 = require("stream");
const _handler_1 = require("./_handler");
const _compression_1 = require("./_compression");
const async_request_handler_1 = require("async-request-handler");
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
        this._for = AND(this._for, condition);
        return this;
    }
    use(handler, ...more) {
        let { _for, _error } = this;
        if (more.length) {
            handler = async_request_handler_1.ASYNC(handler, async_request_handler_1.ASYNC.apply(null, more));
        }
        else {
            handler = async_request_handler_1.ASYNC(handler);
        }
        if (_for)
            handler = async_request_handler_1.IF(_for, handler);
        if (_error)
            handler = async_request_handler_1.ASYNC(handler, async_request_handler_1.CATCH(_error));
        return handler;
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
        this._if = AND(this._if, condition);
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
            if (encoding) {
                res.setHeader("Content-Encoding", encoding);
            }
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
    return (A && B) ? ((arg) => (A(arg) && B(arg))) : (A || B);
}
