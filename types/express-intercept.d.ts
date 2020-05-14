/// <reference types="node" />
import { ErrorRequestHandler, Request, RequestHandler, Response } from "express";
import { Readable } from "stream";
export declare function requestHandler(errorHandler?: ErrorRequestHandler): RequestHandlerBuilder;
export declare function responseHandler(errorHandler?: ErrorRequestHandler): ResponseHandlerBuilder;
declare class RequestHandlerBuilder {
    constructor(errorHandler?: ErrorRequestHandler);
    _error: ErrorRequestHandler;
    /**
     * It appends a test condition to perform the RequestHandler.
     * Call this for multiple times to add multiple tests in AND condition.
     * Those tests could avoid unnecessary work later.
     */
    for(condition: (req: Request) => boolean): this;
    _for: ((req: Request) => boolean);
    /**
     * It returns a RequestHandler which connects multiple RequestHandlers.
     * Use this after `requestHandler()` method but not after `responseHandlder()`.
     */
    use(handler: RequestHandler, ...more: RequestHandler[]): RequestHandler;
    /**
     * It returns a RequestHandler to inspect express Request object (aka `req`).
     * With `requestHandler()`, it works at request phase as normal RequestHandler works.
     */
    getRequest(receiver: (req: Request) => (any | Promise<any>)): RequestHandler;
}
declare class ResponseHandlerBuilder extends RequestHandlerBuilder {
    use: never;
    /**
     * It appends a test condition to perform the RequestHandler.
     * Call this for multiple times to add multiple tests in AND condition.
     * Those tests could avoid unnecessary response interception work including additional buffering.
     */
    if(condition: (res: Response) => boolean): this;
    _if: ((res: Response) => boolean);
    /**
     * It returns a RequestHandler to replace the response content body as a string.
     * It gives a single string even when the response stream is chunked and/or compressed.
     */
    replaceString(replacer: (body: string, req?: Request, res?: Response) => (string | Promise<string>)): RequestHandler;
    /**
     * It returns a RequestHandler to replace the response content body as a Buffer.
     * It gives a single Buffer even when the response stream is chunked and/or compressed.
     */
    replaceBuffer(replacer: (body: Buffer, req?: Request, res?: Response) => (Buffer | Promise<Buffer>)): RequestHandler;
    /**
     * It returns a RequestHandler to replace the response content body as a stream.Readable.
     * Interceptor may need to decompress the response stream when compressed.
     * Interceptor should return yet another stream.Readable to perform transform the stream.
     * Interceptor would use stream.Transform for most cases as it is a Readable.
     * Interceptor could return null or the upstream itself as given if transformation not happened.
     */
    interceptStream(interceptor: (upstream: Readable, req: Request, res: Response) => (Readable | Promise<Readable>)): RequestHandler;
    /**
     * It returns a RequestHandler to retrieve the response content body as a string.
     * It gives a single string even when the response stream is chunked and/or compressed.
     */
    getString(receiver: (body: string, req?: Request, res?: Response) => (any | Promise<any>)): RequestHandler;
    /**
     * It returns a RequestHandler to retrieve the response content body as a Buffer.
     * It gives a single Buffer even when the response stream is chunked and/or compressed.
     */
    getBuffer(receiver: (body: Buffer, req?: Request, res?: Response) => (any | Promise<any>)): RequestHandler;
    /**
     * It returns a RequestHandler to inspect express Request object (aka `req`).
     * With `responseHandlder()`, it works at response returning phase after `res.send()` fired.
     */
    getRequest(receiver: (req: Request) => (any | Promise<any>)): RequestHandler;
    /**
     * It returns a RequestHandler to inspect express Response object (aka `res`) on its response returning phase after res.send() fired.
     */
    getResponse(receiver: (res: Response) => (any | Promise<any>)): RequestHandler;
    compressResponse(): RequestHandler;
    decompressResponse(): RequestHandler;
}
export {};
