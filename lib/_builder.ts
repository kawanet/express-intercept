// _builder.ts

import {Request, RequestHandler, Response} from "express";
import {ResponsePayload} from "./_payload";
import {Writable} from "stream";

type CallbackFn = (err?: Error) => void;

interface IReadable {
    push: (chunk: any, encoding?: string) => void;
    pipe: (destination: Writable) => Writable;
}

export function buildRequestHandler(requestFor: ((req: Request) => boolean), handler: RequestHandler): RequestHandler {
    // without .for() condition
    if (!requestFor) return handler;

    // with .for() condition
    return (req, res, next) => requestFor(req) ? handler(req, res, next) : next();
}

export function buildResponseHandler<T extends IReadable>(
    responseIf: (res: Response) => boolean,
    interceptor?: (payload: T, req: Request, res: Response) => (Promise<T | void>),
    container?: () => T
): RequestHandler {
    return (req, res, next) => {
        let started: boolean;
        let stopped: boolean;
        let payload: IReadable;
        let error: Error;

        const original_write = res.write;
        const intercept_write = res.write = function (chunk: any, encoding?: any, cb?: CallbackFn) {
            if (!started) start();
            if (stopped) return original_write.apply(this, arguments);

            const item = [].slice.call(arguments);
            if ("function" === typeof item[item.length - 1]) cb = item.pop();
            if (item[0]) payload.push(item[0], item[1]);
            if (cb) cb(); // received
            return true;
        };

        const original_end = res.end;
        const intercept_end = res.end = function (chunk?: any, encoding?: any, cb?: CallbackFn) {
            if (!started) start();
            const _stopped = stopped;
            if (!stopped) stop();
            if (_stopped) return original_end.apply(this, arguments);

            const item = [].slice.call(arguments);
            if ("function" === typeof item[item.length - 1]) cb = item.pop();
            if (item[0]) payload.push(item[0], item[1]);
            if (!cb) cb = (e?: Error) => null;
            payload.push(null);
            finish().then(() => cb(), cb);
            return this;
        };

        return next();

        function start() {
            started = true;

            try {
                if (responseIf && !responseIf(res)) return stop(); // .if()
            } catch (e) {
                error = e;
            }

            payload = container ? container() : new ResponsePayload(res) as IReadable;
        }

        function stop() {
            stopped = true;

            // restore to the original methods
            if (res.write === intercept_write) res.write = original_write;
            if (res.end === intercept_end) res.end = original_end;
        }

        async function finish() {
            let readable: IReadable;

            try {
                if (!error && interceptor) {
                    readable = await interceptor(payload as T, req, res) || payload;
                }
            } catch (e) {
                error = e;
            }

            // change response status code if failed before sending body
            if (error) {
                res.status(500);
                res.end();
                return Promise.reject(error);
            }

            readable.pipe(res);
        }
    };
}
