// _handler.ts

import {ErrorRequestHandler, Request, RequestHandler, Response} from "express";
import {ResponsePayload} from "./_payload";
import {Writable} from "stream";

type CallbackFn = (err?: Error) => void;

interface IReadable {
    push: (chunk: any, encoding?: string) => void;
    pipe: (destination: Writable) => Writable;
}

interface BuilderOptions {
    _if: ((res: Response) => boolean);
    _error: ErrorRequestHandler;
}

export function buildResponseHandler<T extends IReadable>(
    options?: BuilderOptions,
    interceptor?: (payload: T, req: Request, res: Response) => (Promise<T | void>),
    container?: () => T
): RequestHandler {
    const {_error, _if} = options || {} as BuilderOptions;

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
            if (payload && item[0]) payload.push(item[0], item[1]);
            if (cb) cb(); // always success

            return true;
        };

        const original_end = res.end;
        const intercept_end = res.end = function (chunk?: any, encoding?: any, cb?: CallbackFn) {
            if (!stopped && !started) start();
            const _stopped = stopped;
            if (!stopped) stop();
            if (_stopped) return original_end.apply(this, arguments);

            const item = [].slice.call(arguments);
            if ("function" === typeof item[item.length - 1]) cb = item.pop();
            if (payload && item[0]) payload.push(item[0], item[1]);
            if (payload) payload.push(null); // EOF

            if (cb) cb(); // always success
            if (error) sendError(error);
            if (!error) finish().catch(sendError);

            return this;
        };

        return next();

        function start() {
            started = true;

            try {
                if (_if && !_if(res)) return stop();
            } catch (e) {
                error = e;
                return;
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
            const readable = interceptor && await interceptor(payload as T, req, res) || payload;
            readable.pipe(res);
        }

        function sendError(err?: Error) {
            if (_error) _error(err, req, res, (e?: any): void => null);
        }
    };
}
