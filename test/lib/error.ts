import {strict as assert} from "node:assert";
import {describe, it} from "node:test";
import type {RequestHandler} from "express";

import {responseHandler} from "../../lib/express-intercept.ts";
import {mwsupertest} from "middleware-supertest";
import type {ExpressModule} from "./util.ts";

const silentHandler = () => responseHandler((err, req, res) => {
    // use .send("") instead of .end(), since Node.js v13
    res.status(500).send("");
});

export function runErrorTests(label: string, express: ExpressModule): void {
    describe(`${label}: error`, () => {

        const success: RequestHandler = (req, res) => res.send("SUCCESS");

        it("200", async () => {
            const app = express().use(success);
            await mwsupertest(app).get("/").expect(200).expect("SUCCESS");
        });

        it("500", async () => {
            const app = express().use((req, res) => res.status(500).end());
            await mwsupertest(app).get("/").expect(500);
        });

        // Express.js captures errors thrown at upstream requestHandler methods.
        // We need only handle errors thrown at downstream responseHandler methods.

        it("responseHandler().if()", async () => {
            await runCase(silentHandler().if(() => {
                throw new Error("if()");
            }).getRequest(() => null));
        });

        it("responseHandler().replaceString()", async () => {
            await runCase(silentHandler().replaceString(() => {
                throw new Error("replaceString()");
            }));
        });

        it("responseHandler().replaceBuffer()", async () => {
            await runCase(silentHandler().replaceBuffer(() => {
                throw new Error("replaceBuffer()");
            }));
        });

        it("responseHandler().interceptStream()", async () => {
            await runCase(silentHandler().interceptStream(() => {
                throw new Error("interceptStream()");
            }));
        });

        it("responseHandler().getString()", async () => {
            await runCase(silentHandler().getString(() => {
                throw new Error("getString()");
            }));
        });

        it("responseHandler().getBuffer()", async () => {
            await runCase(silentHandler().getBuffer(() => {
                throw new Error("getBuffer()");
            }));
        });

        it("responseHandler().getRequest()", async () => {
            await runCase(silentHandler().getRequest(() => {
                throw new Error("getRequest()");
            }));
        });

        it("responseHandler().getResponse()", async () => {
            await runCase(silentHandler().getResponse(() => {
                throw new Error("getResponse()");
            }));
        });

        async function runCase(mw: RequestHandler): Promise<void> {
            const app = express().use(mw).use(success);

            await mwsupertest(app)
                .getResponse(res => assert.equal(+res.statusCode, 500))
                .getString(body => assert.equal(body || "(empty)", "(empty)"))
                .getResponse(res => assert.equal(+res.header("content-length") | 0, 0))
                .get("/")
                .expect(500);
        }
    });
}
