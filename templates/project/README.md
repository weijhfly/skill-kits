# {{projectName}}

A Skill workspace initialized by [skill-kits](https://www.npmjs.com/package/skill-kits).

## Quick start

```bash
pnpm install
pnpm new my-first-skill  # create a Skill
pnpm dev my-first-skill  # dev mode
pnpm build my-first-skill  # build the Skill output
```

> Developing with an AI agent? See [`AGENTS.md`](./AGENTS.md) for a map of the
> reusable `skill-kits/runtime` and `skill-kits/testing` helpers — reuse them
> instead of hand-rolling HTTP / errors / output / tests.

Each Skill's output lives in `packages/skills/<name>/dist/<name>/`, containing:

- `SKILL.md` — Agent metadata (YAML frontmatter + body)
- `scripts/main.mjs` — zero-dependency ESM entry bundled by esbuild
- `references/` / `assets/` — mirrored over if present in the source

The packed `packages/skills/<name>/dist/<name>.zip` shares its root name with the zip, ready to upload to an Agent Skill platform.

## Directory layout

```
.
├── pnpm-workspace.yaml
├── package.json
└── packages/
    ├── shared/         # shared business modules across Skills (@skills/shared)
    └── skills/         # one sub-package per Skill
        └── <name>/
            ├── src/
            ├── SKILL.md
            └── dist/
                ├── <name>/         # Skill output package
                │   ├── SKILL.md
                │   └── scripts/main.mjs
                └── <name>.zip      # upload artifact
```

## Shared business modules

Put business code reused across Skills in `packages/shared/`, then add the dependency in the target Skill's `package.json`:

```json
{
  "dependencies": { "@skills/shared": "workspace:*" }
}
```

At build time, esbuild inlines `@skills/shared` into `dist/<name>/scripts/main.mjs`, keeping the output a zero-dependency single file.

## Common commands

```bash
npx skill-kits new <name>             # create a Skill
npx skill-kits build [name]           # build (all when omitted), auto-pack dist/<name>.zip
npx skill-kits build <name> --no-pack # build only, no zip
npx skill-kits dev <name>             # watch mode: src/SKILL.md/references/assets sync instantly
npx skill-kits dev <name> --out <dir> # emit output to an agent skills dir for live testing
npx skill-kits pack <name>            # pack dist/<name>.zip separately
```
