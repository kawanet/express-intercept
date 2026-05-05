import {strict as assert} from "node:assert";
import {describe, it} from "node:test";

import {requestHandler, responseHandler} from "../../lib/express-intercept.ts";
import {mwsupertest} from "middleware-supertest";
import type {ExpressFactory} from "./util.ts";

export function runConditionTests(label: string, express: ExpressFactory): void {
    describe(`${label}: condition`, () => {
        {
            it("if, for", async () => {
                const app = express();

                app.use(responseHandler()
                    .replaceString((str: string) => str + "/"));

                app.use(responseHandler()
                    .if((res: any) => /A/.test(String(res.getHeader("x-path"))))
                    .replaceString((str: string) => str + "A"));

                app.use(responseHandler()
                    .if((res: any) => /B/.test(String(res.getHeader("x-path"))))
                    .if((res: any) => /C/.test(String(res.getHeader("x-path"))))
                    .replaceString((str: string) => str + "BC"));

                app.use(responseHandler()
                    .for((req: any) => /D/.test(req.path))
                    .replaceString((str: string) => str + "D"));

                app.use(responseHandler()
                    .for((req: any) => /E/.test(req.path))
                    .for((req: any) => /F/.test(req.path))
                    .replaceString((str: string) => str + "EF"));

                app.use(responseHandler()
                    .for((req: any) => /G/.test(req.path))
                    .if((res: any) => /H/.test(String(res.getHeader("x-path"))))
                    .replaceString((str: string) => str + "GH"));

                app.use(requestHandler().use((req: any, res: any) => {
                    res.setHeader("x-path", req.path);
                    res.send("/");
                }));

                await mwsupertest(app).getString(body => assert.equal(body, "/A/")).get("/A/").expect(200).expect("/A/");
                await mwsupertest(app).getString(body => assert.equal(body, "/BC/")).get("/BC/").expect(200).expect("/BC/");
                await mwsupertest(app).getString(body => assert.equal(body, "/D/")).get("/D/").expect(200).expect("/D/");
                await mwsupertest(app).getString(body => assert.equal(body, "/EF/")).get("/EF/").expect(200).expect("/EF/");
                await mwsupertest(app).getString(body => assert.equal(body, "/GH/")).get("/GH/").expect(200).expect("/GH/");
                await mwsupertest(app).getString(body => assert.equal(body, "//")).get("/X/").expect(200).expect("//");
            });
        }
        {
            it("if, for (async)", async () => {
                const app = express();

                app.use(responseHandler()
                    .replaceString(async (str: string) => str + "/"));

                app.use(responseHandler()
                    .if(async (res: any) => /A/.test(String(res.getHeader("x-path"))))
                    .replaceString(async (str: string) => str + "A"));

                app.use(responseHandler()
                    .if(async (res: any) => /B/.test(String(res.getHeader("x-path"))))
                    .if(async (res: any) => /C/.test(String(res.getHeader("x-path"))))
                    .replaceString(async (str: string) => str + "BC"));

                app.use(responseHandler()
                    .for(async (req: any) => /D/.test(req.path))
                    .replaceString(async (str: string) => str + "D"));

                app.use(responseHandler()
                    .for(async (req: any) => /E/.test(req.path))
                    .for(async (req: any) => /F/.test(req.path))
                    .replaceString(async (str: string) => str + "EF"));

                app.use(responseHandler()
                    .for(async (req: any) => /G/.test(req.path))
                    .if(async (res: any) => /H/.test(String(res.getHeader("x-path"))))
                    .replaceString(async (str: string) => str + "GH"));

                app.use(requestHandler().use(async (req: any, res: any) => {
                    res.setHeader("x-path", req.path);
                    res.send("/");
                }));

                await mwsupertest(app).getString(body => assert.equal(body, "/A/")).get("/A/").expect(200).expect("/A/");
                await mwsupertest(app).getString(body => assert.equal(body, "/BC/")).get("/BC/").expect(200).expect("/BC/");
                await mwsupertest(app).getString(body => assert.equal(body, "/D/")).get("/D/").expect(200).expect("/D/");
                await mwsupertest(app).getString(body => assert.equal(body, "/EF/")).get("/EF/").expect(200).expect("/EF/");
                await mwsupertest(app).getString(body => assert.equal(body, "/GH/")).get("/GH/").expect(200).expect("/GH/");
                await mwsupertest(app).getString(body => assert.equal(body, "//")).get("/X/").expect(200).expect("//");
            });
        }
    });
}
