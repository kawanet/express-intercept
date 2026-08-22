import nodeResolve from "@rollup/plugin-node-resolve"
import sucrase from "@rollup/plugin-sucrase"
import type {RollupOptions} from "rollup"
import {showFiles} from "./show-files.ts"

const rollupConfig: RollupOptions = {
    input: "../lib/express-intercept.ts",

    output: {
        file: "../dist/express-intercept.mjs",
        format: "esm",
    },

    // Bare specifiers stay external; only relative paths are bundled.
    external: /^[^.\/]/,

    plugins: [
        nodeResolve({
            preferBuiltins: true,
        }),

        sucrase({
            disableESTransforms: true,
            exclude: ["node_modules/**"],
            transforms: ["typescript"],
        }),

        showFiles(),
    ],
}

export default rollupConfig
