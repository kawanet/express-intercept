// _payload.ts

import {Writable} from "stream";
import {Response} from "express";
import * as zlib from "zlib";

type CallbackFn = (err?: Error) => void;
type ChunkItem = [string | Buffer, any?, any?];

const decoders = {
    br: zlib.brotliDecompressSync,
    gzip: zlib.gunzipSync,
    deflate: zlib.inflateSync,
} as { [encoding: string]: (buf: Buffer) => Buffer };

const encoders = {
    br: zlib.brotliCompressSync,
    gzip: zlib.gzipSync,
    deflate: zlib.deflateSync,
} as { [encoding: string]: (buf: Buffer) => Buffer };

function send(queue: ChunkItem[], dest: Writable, cb?: CallbackFn) {
    let error: Error;

    try {
        queue.forEach(item => {
            if (!error) dest.write(item[0], item[1], catchError);
        });
    } catch (e) {
        catchError(e);
    }

    // close stream even on error
    try {
        dest.end(sendResult);
    } catch (e) {
        catchError(e);
    }

    if (cb) cb(); // success callback

    function catchError(e: Error) {
        error = error || e;
    }

    function sendResult(e: Error) {
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
        const buffers = queue.map(item => item[0]).map(chunk => Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));

        // concat Buffer
        let buffer = Buffer.concat(buffers);

        // uncompress Buffer
        const contentEncoding = res.getHeader("Content-Encoding") as string;
        const transferEncoding = res.getHeader("Transfer-Encoding") as string;
        const decoder = decoders[contentEncoding] || decoders[transferEncoding];

        if (decoder && buffer.length) {
            buffer = decoder(buffer);
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

        // compress Buffer as before
        const contentEncoding = res.getHeader("Content-Encoding") as string;
        const transferEncoding = res.getHeader("Transfer-Encoding") as string;
        const encoder = encoders[contentEncoding] || encoders[transferEncoding];

        if (encoder && buffer.length) {
            buffer = encoder(buffer);
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
