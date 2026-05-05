import {strict as assert} from "node:assert";
import {describe, it} from "node:test";
import type {Express} from "express";

import {responseHandler} from "../../lib/express-intercept.ts";
import {mwsupertest} from "middleware-supertest";

function toHEX(buf: Buffer) {
    return Buffer.from(buf).toString("hex") || "(empty)";
}

export function runReplaceBufferTests(label: string, express: () => Express): void {
    describe(`${label}: replace-buffer`, () => {
        const empty = Buffer.of();
        const source = Buffer.from("ABCD");
        const expected = Buffer.from("XYZ");

        {
            it("replaceBuffer", async () => {
                const app = express();
                app.use(responseHandler().replaceBuffer(() => expected));
                app.use((req, res) => res.type("application/octet-stream").end(source));

                await mwsupertest(app)
                    .getResponse(res => assert.equal(+res.statusCode, 200))
                    .getResponse(res => assert.equal(+res.getHeader("content-length"), expected.length))
                    .getBuffer(body => assert.equal(toHEX(body), toHEX(expected)))
                    .get("/")
                    .expect(200)
                    .then(res => assert.equal(toHEX(res.body), toHEX(expected)));
            });
        }

        {
            it("replaceBuffer async", async () => {
                const app = express();
                app.use(responseHandler().replaceBuffer(async () => expected));
                app.use((req, res) => res.type("application/octet-stream").end(source));

                await mwsupertest(app)
                    .getResponse(res => assert.equal(+res.statusCode, 200))
                    .getResponse(res => assert.equal(+res.getHeader("content-length"), expected.length))
                    .getBuffer(body => assert.equal(toHEX(body), toHEX(expected)))
                    .get("/")
                    .expect(200)
                    .then(res => assert.equal(toHEX(res.body), toHEX(expected)));
            });
        }

        {
            it("replaceBuffer to empty", async () => {
                const app = express();
                app.use(responseHandler().replaceBuffer(async () => empty));
                app.use((req, res) => res.type("application/octet-stream").send(source));

                await mwsupertest(app)
                    .getResponse(res => assert.equal(+res.statusCode, 200))
                    .getResponse(res => assert.equal(+res.getHeader("content-length") | 0, 0))
                    .getBuffer(body => assert.equal(toHEX(body), toHEX(empty)))
                    .get("/")
                    .expect(200)
                    .then(res => assert.equal(toHEX(res.body), toHEX(empty)));
            });
        }

        {
            it("replaceBuffer from empty", async () => {
                const app = express();
                app.use(responseHandler().replaceBuffer(async () => expected));
                app.use((req, res) => res.type("application/octet-stream").send(empty));

                await mwsupertest(app)
                    .getResponse(res => assert.equal(+res.statusCode, 200))
                    .getResponse(res => assert.equal(+res.getHeader("content-length"), expected.length))
                    .getBuffer(body => assert.equal(toHEX(body), toHEX(expected)))
                    .get("/")
                    .expect(200)
                    .then(res => assert.equal(toHEX(res.body), toHEX(expected)));
            });
        }
    });
}
