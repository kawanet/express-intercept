// _payload.ts

import {Writable} from "stream";
import type {Response} from "express";
import {compressBuffer, decompressBuffer, findEncoding} from "./_compression.js";

type CallbackFn = (err?: Error) => void;
type ChunkItem = [string | Buffer, any?, any?];

function send(queue: ChunkItem[], dest: Writable, cb?: CallbackFn) {
    let error: Error;

    if (queue.length === 1) {
        const item = queue[0];
        try {
            dest.end(item[0], item[1], sendResult);
        } catch (e) {
            catchError(e);
        }
    } else {
        try {
            queue.forEach(item => {
                if (!error) dest.write(item[0], item[1], catchError);
            });
        } catch (e) {
            catchError(e);
        }

        // close stream even after error
        try {
            dest.end(sendResult);
        } catch (e) {
            catchError(e);
        }
    }

    if (cb) cb(); // success callback

    function catchError(e: Error) {
        error = error || e;
    }

    function sendResult(e?: Error) {
        if (cb) cb(e || error);
        cb = null; // callback only once
    }
}

export class ResponsePayload {
    queue: ChunkItem[] = [];

    constructor(private res: Response) {
        //
    }

    push(chunk: any, encoding?: string): void {
        if (chunk == null) return; // EOF
        this.queue.push([chunk, encoding]);
    }

    pipe(destination: Writable): Writable {
        send(this.queue, destination);
        return destination;
    }

    getBuffer(): Buffer {
        const {queue, res} = this;

        // force Buffer
        const buffers = queue.map(item => Buffer.isBuffer(item[0]) ? item[0] : Buffer.from(item[0], item[1]));

        // concat Buffer
        let buffer = (buffers.length === 1) ? buffers[0] : Buffer.concat(buffers);

        // decompress Buffer
        const encoding = findEncoding(res.getHeader("Content-Encoding"));
        if (encoding && buffer.length) {
            buffer = decompressBuffer(buffer, encoding);
        }

        return buffer;
    }

    setBuffer(buffer: Buffer) {
        const {queue, res} = this;
        if (!buffer) buffer = Buffer.of();

        // ETag:
        var etagFn = res.app && res.app.get('etag fn')
        if ("function" === typeof etagFn) {
            res.setHeader("ETag", etagFn(buffer));
        } else {
            res.removeHeader("ETag");
        }

        // recompress Buffer as compressed before
        const encoding = findEncoding(res.getHeader("Content-Encoding"));
        if (encoding && buffer.length) {
            buffer = compressBuffer(buffer, encoding);
        }

        const length = +buffer.length;
        if (length) {
            res.setHeader("Content-Length", "" + length);
        } else {
            res.removeHeader("Content-Length");
        }

        // empty
        queue.splice(0);

        // update
        queue.push([buffer]);
    }

    getString(): string {
        const {queue} = this;

        // shortcut when only string chunks given and no Buffer chunks mixed
        const stringOnly = !queue.filter(chunk => "string" !== typeof chunk[0]).length;
        if (stringOnly) return queue.map(item => item[0]).join("");

        const buffer = this.getBuffer();

        // Buffer to string
        return buffer.toString();
    }

    setString(text: string) {
        if (!text) text = "";
        const buffer = Buffer.from(text);
        this.setBuffer(buffer);
    }
}
