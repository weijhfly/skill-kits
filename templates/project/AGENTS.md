# AGENTS.md

Guidance for AI agents working in this **skill-kits** workspace.

When writing or editing a Skill command, **reuse the helpers shipped by `skill-kits`
before writing your own**. Do NOT hand-roll HTTP clients, error types, stdout/stderr
output, env reading, polling, or test mocks — they already exist and define the
conventions this workspace relies on.

Two entry points (resolve to `node_modules/skill-kits/dist/`):

- `skill-kits/runtime` — used by Skill source under `packages/skills/<name>/src/`
- `skill-kits/testing` — used by `*.test.ts` (run with `pnpm test`)

## `skill-kits/runtime`

### Command router — build the CLI entry, don't parse argv yourself

```ts
import { createRouter } from "skill-kits/runtime";

const router = createRouter({
  name: "my-skill",
  description: "what this skill does",
  // commonArgs are injected into every command (typed):
  // commonArgs: { token: { type: "string", required: true, desc: "auth token" } },
});

router.command({
  name: "greet",
  description: "echo a message",
  args: {
    message: { type: "string", required: true, desc: "text to echo" },
    // ArgType: "string" | "number" | "boolean" | "list" | "json"
    // string args may set `choices: [...]` for validation
  },
  handler({ message }) { /* ... */ },
});

router.run(process.argv.slice(2));
```

The router auto-handles `--help`, required-arg validation, choices validation, and
top-level error catching (via `handleCliError`).

### HTTP — `httpGet` / `httpPost` / `httpRequest`

```ts
import { httpGet, httpPost } from "skill-kits/runtime";

const res = await httpGet<MyData>(url, { query: { page: 1 }, timeoutMs: 10_000 });
// res: { ok, status, statusText, headers, data, text }
// Never throws on network/timeout: returns { ok: false, status: 0, ... }
const created = await httpPost(url, { name: "x" }); // object body → auto JSON + content-type
```

### Errors — throw these, the router formats them consistently

```ts
import { UserInputError, AuthError, HttpError, BusinessApiError, SkillError } from "skill-kits/runtime";

throw new UserInputError("missing --id");              // code: USER_INPUT_ERROR
throw new AuthError("token expired");                  // code: AUTH_ERROR
throw new HttpError(500, url, "upstream failed");       // code: HTTP_ERROR
throw new BusinessApiError(bizCode, msg, { hintMap }); // HTTP 200 but business code != 0
// Custom code: extend SkillError -> super("RATE_LIMIT", msg)
```

### Output — strict stdout / stderr split (don't use console.log)

```ts
import { writeResult, writeError, notify } from "skill-kits/runtime";

writeResult({ ok: true, data });  // stdout: single-line JSON for the Agent to consume
writeError(err);                  // stderr: structured error JSON + sets exitCode = 1
notify("step 1 done");            // stderr: progress hint (won't pollute stdout)
```

### Env — `requireEnv` / `optionalEnv`

```ts
import { requireEnv, optionalEnv } from "skill-kits/runtime";

const token = requireEnv("API_TOKEN", { hint: "get one at https://..." }); // throws UserInputError if missing
const pat = optionalEnv("OPTIONAL_TOKEN");                                 // string | null
```

### Polling — `sleepWithHeartbeat` (keeps the Agent from killing an idle process)

```ts
import { sleepWithHeartbeat } from "skill-kits/runtime";

await sleepWithHeartbeat(60_000, { message: (rem) => `waiting... ${rem}s left` });
```

## `skill-kits/testing`

The common goal is **testing a command's exit behavior**: call the command function,
then assert the stdout JSON and `exitCode`. `mockFetch` is only needed when the command
talks to the network — pure logic needs no helper at all.

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { mockFetch, captureOutput } from "skill-kits/testing";
import { toSeconds } from "./utils.js";
import { createActivity } from "./create-activity.js";

// 1) Pure function — just import and assert, no helper needed.
test("toSeconds normalizes 13-digit ms to 10-digit s", () => {
  assert.equal(toSeconds(1717000000000), 1717000000);
});

const ctx = { domain: "https://example.com", token: "t" }; // resolved commonArgs

// 2) Command success path — wrap the handler in captureOutput; add mockFetch for HTTP.
test("create returns ok with backend data", async () => {
  const mock = mockFetch([
    { match: /\/activity\/create/, json: { code: 0, data: { activity_id: 9001 } } },
  ]);
  try {
    const { json, exitCode } = await captureOutput(() =>
      createActivity(ctx, { act_name: "test" }),
    );
    assert.equal(exitCode, 0);
    assert.equal((json as { activity_id: number }).activity_id, 9001);
  } finally {
    mock.restore();
  }
});

// 3) Error path — command functions throw SkillError (the router maps it to
//    exit 1 + stderr JSON at the top level), so assert on the thrown error.
test("missing required arg throws UserInputError", async () => {
  await assert.rejects(
    () => captureOutput(() => createActivity(ctx, {})),
    "required",
  );
});
```

- `captureOutput(fn)` — runs `fn` with stdout/stderr captured and `exitCode` reset,
  returns `{ stdout, stderr, json, exitCode }` (`json` = parsed stdout). Restores
  everything even if `fn` throws. Use it for the success path; for the error path,
  command functions `throw`, so use `assert.rejects` instead.
- `mockFetch(routes)` — replaces global `fetch`; match by substring / RegExp / fn;
  reply with `json` / `text` / `status` / custom `response`. An unmatched request
  throws. Call `restore()` in `finally`.
- Not every test needs `mockFetch` — pure functions just import and assert directly.

## Need full signatures?

Read the type declarations and README in the installed package:

- `node_modules/skill-kits/README.md`
- `node_modules/skill-kits/dist/runtime/*.d.ts`
- `node_modules/skill-kits/dist/testing/*.d.ts`
