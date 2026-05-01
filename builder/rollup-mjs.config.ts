import nodeResolve from "@rollup/plugin-node-resolve"
import sucrase from "@rollup/plugin-sucrase"
import type {RollupOptions} from "rollup"
import {isExternal} from "./externals.ts"
import {showFiles} from "./show-files.ts"

const rollupConfig: RollupOptions = {
    input: "../lib/express-intercept.ts",

    output: {
        file: "../dist/express-intercept.mjs",
        format: "esm",
    },

    external: isExternal,

    plugins: [
        nodeResolve({
            preferBuiltins: true,
        }),

        sucrase({
            exclude: ["node_modules/**"],
            transforms: ["typescript"],
        }),

        showFiles(),
    ],
}

export default rollupConfig
