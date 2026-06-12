---
name: {{skillName}}
description: >
  Summarize the core capability in one sentence (start with a verb, e.g. "Complete task Y via platform X's OpenAPI").
  Invoke it when the user mentions "keyword A / keyword B" or asks to "perform action Y".
  Not for: scenarios unrelated to X / tasks outside the Y domain (list 1-2 easily-confused counterexamples).
metadata:
  author: your-name
  version: "1.0.0"
---

# {{skillName}}

<!-- Summarize the core workflow in 1-2 sentences, e.g. "Generate code from a Figma link and commit it to the repo." -->

## Commands

### `hello`

Echo the input.

| Argument    | Type   | Required | Description        |
| ----------- | ------ | -------- | ------------------ |
| `--message` | string | ✅       | Text to echo back  |

```bash
node scripts/main.mjs hello --message "hi"
# → {"ok":true,"echo":"hi"}
```

> Argument details in [references/api.md](references/api.md) (if any).

## Failure handling

| Scenario             | Action                                            |
| -------------------- | ------------------------------------------------- |
| Missing argument     | Provide the required argument and retry           |
| Auth failure         | Re-fetch the token                                |
| Upstream API error   | Check the error code; retry if it's transient     |

> Full error codes in [references/errors.md](references/errors.md) (if any).

## Notes

- Runtime: Node.js >= 18
- All commands support `--help` to view argument descriptions
