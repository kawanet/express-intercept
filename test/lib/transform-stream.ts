import {strict as assert} from "node:assert";
import {describe, it} from "node:test";
import {Transform} from "node:stream";
import type {RequestHandler} from "express";

import {responseHandler} from "../../lib/express-intercept.ts";
import {mwsupertest} from "middleware-supertest";
import type {ExpressModule} from "./util.ts";

export function runTransformStreamTests(label: string, express: ExpressModule): void {
    describe(`${label}: transform-stream`, () => {
        const source = "Hello, world!";
        const expected = "HELLO, WORLD!!";

        const replacer = (body: string) => {
            body = String(body).toUpperCase();
            body = body.replace(/!/g, "!!");
            return body;
        };

        it("transform stream: send()", async () => {
            await runCase((req, res) => {
                res.send(source);
            });
        });

        it("transform stream: write()", async () => {
            await runCase((req, res) => {
                res.status(200).type("html");
                res.write(source);
                res.end();
            });
        });

        it("transform stream: end()", async () => {
            await runCase((req, res) => {
                res.status(200).type("html");
                res.end(source);
            });
        });

        it("transform stream: chunked", async () => {
            await runCase((req, res) => {
                res.status(200).type("html");
                source.split("").forEach(c => res.write(c));
                res.end();
            });
        });

        it("transform string: chunked", async () => {
            await runCase((req, res) => {
                res.status(200).type("html");
                source.split("").forEach(c => res.write(c));
                res.end();
            }, responseHandler().replaceString(replacer));
        });

        async function runCase(handler: RequestHandler, transform?: RequestHandler): Promise<void> {
            const app = express();

            app.use(transform || responseHandler().interceptStream((upstream, req, res) => {
                const transform = new Transform({
                    transform(chunk, encoding, callback) {
                        res.removeHeader("Content-Length");
                        chunk = Buffer.from(replacer(String(chunk)));
                        this.push(chunk);
                        callback();
                    },
                });

                return upstream.pipe(transform);
            }));

            app.use(handler);

            await mwsupertest(app)
                .getString(body => assert.equal(body, expected))
                .get("/")
                .expect(200)
                .expect(expected);
        }
    });
}
