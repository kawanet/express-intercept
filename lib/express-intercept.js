"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const stream_1 = require("stream");
const _builder_1 = require("./_builder");
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
        return _builder_1.buildRequestHandler(this._for, handler);
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
        return super.use(_builder_1.buildResponseHandler(this._if, async (payload, req, res) => {
            let body = payload.getString();
            body = await replacer(body, req, res);
            payload.setString(body);
        }));
    }
    replaceBuffer(replacer) {
        return super.use(_builder_1.buildResponseHandler(this._if, async (payload, req, res) => {
            let body = payload.getBuffer();
            body = await replacer(body, req, res);
            payload.setBuffer(body);
        }));
    }
    interceptStream(interceptor) {
        return super.use(_builder_1.buildResponseHandler(this._if, async (payload, req, res) => {
            return interceptor(payload, req, res);
        }, () => new ReadablePayload()));
    }
    getString(receiver) {
        return super.use(_builder_1.buildResponseHandler(this._if, async (payload, req, res) => {
            const body = payload.getString();
            await receiver(body, req, res);
        }));
    }
    getBuffer(receiver) {
        return super.use(_builder_1.buildResponseHandler(this._if, async (payload, req, res) => {
            const body = payload.getBuffer();
            await receiver(body, req, res);
        }));
    }
    getRequest(receiver) {
        return super.use(_builder_1.buildResponseHandler(this._if, async (payload, req, res) => {
            await receiver(req);
        }));
    }
    getResponse(receiver) {
        return super.use(_builder_1.buildResponseHandler(this._if, async (payload, req, res) => {
            await receiver(res);
        }));
    }
}
class ReadablePayload extends stream_1.Readable {
    _read() {
    }
}
function AND(A, B) {
    return (arg) => (A(arg) && B(arg));
}
function JOIN(A, B) {
    return (req, res, next) => A(req, res, err => (err ? next(err) : B(req, res, next)));
}
