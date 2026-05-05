// Integration tests for the Express 5 line.

import express from "express5";

import {runCompressionTests} from "./lib/compression.ts";
import {runConditionTests} from "./lib/condition.ts";
import {runErrorTests} from "./lib/error.ts";
import {runGetResponseTests} from "./lib/get-response.ts";
import {runNotModifiedTests} from "./lib/not-modified.ts";
import {runReplaceBufferTests} from "./lib/replace-buffer.ts";
import {runReplaceStringTests} from "./lib/replace-string.ts";
import {runStackHeaderTests} from "./lib/stack-header.ts";
import {runTransformStreamTests} from "./lib/transform-stream.ts";

const label = "express5";

runCompressionTests(label, express);
runConditionTests(label, express);
runErrorTests(label, express);
runGetResponseTests(label, express);
runNotModifiedTests(label, express);
runReplaceBufferTests(label, express);
runReplaceStringTests(label, express);
runStackHeaderTests(label, express);
runTransformStreamTests(label, express);
