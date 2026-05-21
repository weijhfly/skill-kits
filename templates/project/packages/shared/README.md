# @skills/shared

跨 Skill 复用的业务公共模块。runtime 之外、属于你业务领域的工具/常量/客户端，都放这里。

## 用法

1. 在目标 Skill 的 `package.json` 中加依赖：

   ```json
   {
     "dependencies": {
       "@skills/shared": "workspace:*"
     }
   }
   ```

2. 执行 `pnpm install`。
3. 在源码中导入：

   ```ts
   import { greet } from "@skills/shared";
   ```

构建时 esbuild 会把 `@skills/shared` 的代码内联进 `dist/<skill-name>/scripts/main.mjs`，产物依旧零依赖单文件。
