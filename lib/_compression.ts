// _compression.ts

import * as zlib from "zlib";

interface Encodings<T> {
    br: T,
    deflate: T,
    gzip: T,
}

type Encoding = keyof Encodings<any>;

const decoders = {
    br: zlib.brotliDecompressSync,
    gzip: zlib.gunzipSync,
    deflate: zlib.inflateSync,
} as Encodings<(buf: Buffer) => Buffer>;

const encoders = {
    br: zlib.brotliCompressSync,
    gzip: zlib.gzipSync,
    deflate: zlib.deflateSync,
} as Encodings<(buf: Buffer) => Buffer>;

export function findEncoding(encoding: string | any): Encoding {
    return String(encoding).split(/\W+/).filter(e => !!decoders[e as Encoding]).shift() as Encoding;
}

export function decompressBuffer(buf: Buffer, encoding: Encoding): Buffer {
    const decoder = decoders[encoding];
    return decoder(buf);
}

export function compressBuffer(buf: Buffer, encoding: Encoding): Buffer {
    const encoder = encoders[encoding];
    return encoder(buf);
}
