import {describe, it} from "node:test";

import {responseHandler} from "../../lib/express-intercept.ts";
import {mwsupertest} from "middleware-supertest";
import {stackRequestHeader} from "./stack-request-header.ts";
import type {ExpressFactory} from "./util.ts";

export function runStackHeaderTests(label: string, express: ExpressFactory): void {
    describe(`${label}: stack-header`, () => {
        const addResponseHeader = (key: string) => responseHandler().interceptStream((upstream, req, res) => {
            res.setHeader(key, (req.header("x-foo") || "---") + "/" + (req.header("x-bar") || "---"));
            return upstream;
        });

        it("stackRequestHeader()", async () => {
            const app = express();
            app.use(addResponseHeader("x-ret1"));
            app.use(stackRequestHeader({"x-foo": "FOO"}));
            app.use(addResponseHeader("x-ret2"));
            app.use(stackRequestHeader({"x-bar": "BAR"}));
            app.use(addResponseHeader("x-ret3"));
            app.use(stackRequestHeader({"x-foo": "BAZ"}));
            app.use(addResponseHeader("x-ret4"));
            app.use((req: any, res: any) => res.send("OK"));

            await mwsupertest(app)
                .get("/")
                .set({"x-bar": "QUX"})
                .expect(200)
                .expect("x-ret1", "---/QUX")
                .expect("x-ret2", "FOO/QUX")
                .expect("x-ret3", "FOO/BAR")
                .expect("x-ret4", "BAZ/BAR")
                .expect("OK");
        });
    });
}
