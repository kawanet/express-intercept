"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const zlib = require("zlib");
const decoders = {
    br: zlib.brotliDecompressSync,
    gzip: zlib.gunzipSync,
    deflate: zlib.inflateSync,
};
const encoders = {
    br: zlib.brotliCompressSync,
    gzip: zlib.gzipSync,
    deflate: zlib.deflateSync,
};
function findEncoding(encoding) {
    return String(encoding).split(/\W+/).filter(e => !!decoders[e]).shift();
}
exports.findEncoding = findEncoding;
function decompressBuffer(buf, encoding) {
    const decoder = decoders[encoding];
    return decoder(buf);
}
exports.decompressBuffer = decompressBuffer;
function compressBuffer(buf, encoding) {
    const encoder = encoders[encoding];
    return encoder(buf);
}
exports.compressBuffer = compressBuffer;
