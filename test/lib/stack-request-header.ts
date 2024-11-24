// stack-request-header.ts

import {Request, RequestHandler} from "express";
import {requestHandler, responseHandler} from "../../lib/express-intercept.js";

type Headers = { [key: string]: string }; // http.IncomingHttpHeaders

export function stackRequestHeader(headers: Headers): RequestHandler {
    const keys = Object.keys(headers);
    const stack = {} as Headers;

    return requestHandler().use(
        requestHandler().getRequest(pushHeader),
        responseHandler().getRequest(popHeader)
    );

    function pushHeader(req: Request) {
        const reqHeaders = req.headers;
        keys.forEach(key => {
            const val = headers[key];
            if (val) {
                stack[key] = reqHeaders[key] as string;
                reqHeaders[key] = val;
            } else {
                delete reqHeaders[key];
            }
        });
    }

    function popHeader(req: Request) {
        const reqHeaders = req.headers;
        keys.forEach(key => {
            reqHeaders[key] = stack[key];
        });
    }
}
