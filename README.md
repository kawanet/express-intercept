# express-intercept

Build Express middleware to intercept / replace / inspect / transform response

## SYNOPSIS

```js
const express = require("express");
const {requestHandler, responseHandlder} = require("express-intercept");
const app = express();

// replace response string if response Content-Type is html.

app.use(responseHandlder().if(res => /html/i.test(res.getHeader("content-type"))).replaceString(body => body.replace(/MacBook/g, "Surface")));

// log access_token for request path: /login

app.use(responseHandlder().for(req => (req.path === "/login")).getString(body => console.warn(JSON.parse(body).access_token)));

// dump response body to file if statusCode is Internal Server Error

app.use(responseHandlder().if(res => (+res.statusCode === 500)).getBuffer(body => fs.promises.writeFile("debug", body)));

// log cookie sent in request

app.use(requestHandler().getRequest(req => console.warn(req.getHeader("cookie"))));

// log cookie sending in response

app.use(responseHandlder().getResponse(res => console.warn(res.getHeader("set-cookie"))));

// compress response. see test/lib/compress.ts for real code

app.use(responseHandler().interceptStream(upstream => upstream.pipe(zlib.createBrotliCompress())));
```

## METHODS

#### `for(condition: (req: Request) => boolean)`

It appends a test condition to perform the RequestHandler.
Call this for multiple times to add multiple tests in AND condition.
Those tests could avoid unnecessary work later.

#### `if(condition: (res: Response) => boolean)`

It appends a test condition to perform the RequestHandler.
Call this for multiple times to add multiple tests in AND condition.
Those tests could avoid unnecessary response interception work including additional buffering.

#### `replaceString(replacer: (body: string, req: Request, res: Response) => string))`

It returns a RequestHandler to replace the response content body as a string.
It manages the response stream even when chunked or compressed.

#### `replaceBuffer(replacer: (body: Buffer, req: Request, res: Response) => Buffer>)`

It returns a RequestHandler to replace the response content body as a Buffer.
It manages the response stream even when chunked or compressed.

#### `interceptStream(interceptor: (upstream: Readable, req: Request, res: Response) => Readable)`

It returns a RequestHandler to replace the response content body as a stream.Readable.
It passes raw response as a stream.Readable whether compressed or not.
Interceptor should return yet another stream.Readable to perform transform the stream.
Interceptor would use stream.Transform for most cases as it is a Readable.
Interceptor could return null or the upstream itself as given if transformation not happened.

#### `getString(receiver: (body: string, req: Request, res: Response) => void)`

It returns a RequestHandler to retrieve the response content body as a string.
It manages the response stream even when chunked or compressed.

#### `getBuffer(receiver: (body: Buffer, req: Request, res: Response) => void)`

It returns a RequestHandler to retrieve the response content body as a Buffer.
It manages the response stream even when chunked or compressed.

#### `getRequest(receiver: (req: Request) => void)`

It returns a RequestHandler to inspect express Request object (aka `req`).
With `requestHandler()`, it works at request phase as normal RequestHandler works.
With `responseHandlder()`, it works at response returning phase after `res.send()` fired.

#### `getResponse(receiver: (res: Response) => void)`

It returns a RequestHandler to inspect express Response object (aka `res`).
It works at response returning phase after `res.send()` fired.

#### `use(handler: RequestHandler, ...more)`

It returns a RequestHandler which connects multiple RequestHandlers.
Use this after `requestHandler()` method but not after `responseHandlder()`.

## SEE ALSO

- https://github.com/kawanet/express-sed
- https://github.com/kawanet/express-tee

## LICENSE

The MIT License (MIT)

Copyright (c) 2020 Yusuke Kawasaki

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
