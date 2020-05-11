/// <reference types="node" />
import { Request, RequestHandler, Response } from "express";
import { Duplex } from "stream";
export declare const requestHandler: () => RequestHandlerBuilder;
export declare const responseHandler: () => ResponseHandlerBuilder;
declare class RequestHandlerBuilder {
    private _for;
    for(condition: (req: Request) => boolean): this;
    use(handler: RequestHandler, ...more: RequestHandler[]): RequestHandler;
    getRequest(receiver: (req: Request) => (any | Promise<any>)): RequestHandler;
}
declare class ResponseHandlerBuilder extends RequestHandlerBuilder {
    private _if;
    use: never;
    if(condition: (res: Response) => boolean): this;
    replaceString(replacer: (body: string, req?: Request, res?: Response) => (string | Promise<string>)): RequestHandler;
    replaceBuffer(replacer: (body: Buffer, req?: Request, res?: Response) => (Buffer | Promise<Buffer>)): RequestHandler;
    getString(receiver: (body: string, req?: Request, res?: Response) => (any | Promise<any>)): RequestHandler;
    getBuffer(receiver: (body: Buffer, req?: Request, res?: Response) => (any | Promise<any>)): RequestHandler;
    getRequest(receiver: (req: Request) => (any | Promise<any>)): RequestHandler;
    getResponse(receiver: (res: Response) => (any | Promise<any>)): RequestHandler;
    transformStream(interceptor: (req: Request, res: Response) => (Duplex | Promise<Duplex>)): RequestHandler;
}
export {};
