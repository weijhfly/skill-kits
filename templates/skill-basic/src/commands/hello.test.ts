/**
 * Example test: demonstrates skill-kits' two test helpers.
 *
 * Run: `pnpm test` (i.e. `skill-kits test {{skillName}}`)
 *
 * - mockFetch: replace the global fetch, returning fake responses by url, to test HTTP logic
 * - captureOutput: capture writeResult/writeError output and exit code, to test command exits
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { captureOutput } from "skill-kits/testing";
import { runHello } from "./hello.js";

test("runHello writes the echo result to stdout", async () => {
  const { json, exitCode } = await captureOutput(() => runHello("hi"));
  assert.equal(exitCode, 0);
  assert.deepEqual(json, { ok: true, echo: "hi" });
});

// HTTP-backed logic can be tested like this (uncomment and adjust as needed):
//
// import { mockFetch } from "skill-kits/testing";
//
// test("calls the upstream API", async () => {
//   const mock = mockFetch([
//     { match: /\/api\/users/, json: { code: 0, data: { id: 1 } } },
//   ]);
//   const result = await fetchUser("u1");
//   assert.equal(result.id, 1);
//   mock.restore();
// });
