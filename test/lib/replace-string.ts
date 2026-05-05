import {strict as assert} from "node:assert";
import {describe, it} from "node:test";

import {responseHandler} from "../../lib/express-intercept.ts";
import {mwsupertest} from "middleware-supertest";
import type {ExpressFactory} from "./util.ts";

export function runReplaceStringTests(label: string, express: ExpressFactory): void {
    describe(`${label}: replace-string`, () => {
        const empty = "";
        const source = "Hello, {{name}}!";
        const expected = "Hello, John!";

        {
            it("replaceString", async () => {
                const app = express();
                app.use(responseHandler().replaceString(str => str.replace("{{name}}", "John")));
                app.use((req: any, res: any) => res.send(source));

                await mwsupertest(app)
                    .getResponse(res => assert.equal(+res.statusCode, 200))
                    .getResponse(res => assert.equal(+res.getHeader("content-length"), expected.length))
                    .getString(body => assert.equal(body, expected))
                    .get("/")
                    .expect(200)
                    .then(res => assert.equal(res.text, expected));
            });
        }

        {
            it("replaceString async", async () => {
                const app = express();
                app.use(responseHandler().replaceString(async str => str.replace("{{name}}", "John")));
                app.use((req: any, res: any) => res.send(source));

                await mwsupertest(app)
                    .getResponse(res => assert.equal(+res.statusCode, 200))
                    .getResponse(res => assert.equal(+res.getHeader("content-length"), expected.length))
                    .getString(body => assert.equal(body, expected))
                    .get("/")
                    .expect(200)
                    .then(res => assert.equal(res.text, expected));
            });
        }

        {
            it("replaceString to empty", async () => {
                const app = express();
                app.use(responseHandler().replaceString(async () => empty));
                app.use((req: any, res: any) => res.send(source));

                await mwsupertest(app)
                    .getResponse(res => assert.equal(+res.statusCode, 200))
                    .getResponse(res => assert.equal(+res.getHeader("content-length") | 0, 0))
                    .getString(body => assert.equal(body, empty))
                    .get("/")
                    .expect(200)
                    .then(res => assert.equal(res.text || "empty", "empty"));
            });
        }

        {
            it("replaceString from empty", async () => {
                const app = express();
                app.use(responseHandler().replaceString(async () => expected));
                app.use((req: any, res: any) => res.send(empty));

                await mwsupertest(app)
                    .getResponse(res => assert.equal(+res.statusCode, 200))
                    .getResponse(res => assert.equal(+res.getHeader("content-length"), expected.length))
                    .getString(body => assert.equal(body, expected))
                    .get("/")
                    .expect(200)
                    .then(res => assert.equal(res.text, expected));
            });
        }

        {
            it("replaceString without change", async () => {
                const app = express();
                app.use(responseHandler().replaceString(str => str));
                app.use((req: any, res: any) => res.send(expected));

                await mwsupertest(app)
                    .getResponse(res => assert.equal(+res.statusCode, 200))
                    .getResponse(res => assert.equal(+res.getHeader("content-length"), expected.length))
                    .getString(body => assert.equal(body, expected))
                    .get("/")
                    .expect(200)
                    .then(res => assert.equal(res.text, expected));
            });
        }
    });
}
