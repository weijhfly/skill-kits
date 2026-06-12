# @skills/shared

Shared business modules reused across Skills. Beyond runtime, put your domain-specific utilities/constants/clients here.

## Usage

1. Add the dependency in the target Skill's `package.json`:

   ```json
   {
     "dependencies": {
       "@skills/shared": "workspace:*"
     }
   }
   ```

2. Run `pnpm install`.
3. Import in source:

   ```ts
   import { greet } from "@skills/shared";
   ```

At build time, esbuild inlines `@skills/shared` into `dist/<skill-name>/scripts/main.mjs`, keeping the output a zero-dependency single file.
