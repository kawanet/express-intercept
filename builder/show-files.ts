import path from "node:path"
import {fileURLToPath} from "node:url"
import type {Plugin} from "rollup"

export const showFiles = (): Plugin => {
    const projectRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")

    return {
        name: "show-files",
        load(id) {
            id = id.replace(projectRoot, "").replace(/^\//, "")
            console.warn(`import: ${id}`)
        },
    }
}
