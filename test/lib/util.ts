// Common helpers for the per-topic test runners.

// The full Express module/namespace value: call signature + namespace
// methods (`.static`, `.Router`, `.json`, ...). The runners here only
// call `express()`, but adopting the family alias keeps the test-side
// typing identical across the repo group and ready to absorb future
// namespace usage without another rename round.
//
// Express ships as a CommonJS `export = e` namespace, so
// `typeof import("express")` resolves to the value of `import express
// from "express"` directly (no `.default`).
export type ExpressModule = typeof import("express");
