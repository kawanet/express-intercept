// Common helpers for the per-topic test runners.

// Wrapper that matches the minimal shape of both Express 4 and 5; only
// needs to be callable as `express()`.
export type ExpressFactory = any;
