import { build as esbuild, context as esbuildContext } from "esbuild";
import { existsSync, watch as fsWatch } from "node:fs";
import { copyFile, mkdir, readdir, rm, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parseSkillMd } from "./skill-md.js";

export interface BuildOptions {
  /** Skill 源码目录（必须包含 SKILL.md 与 src/main.ts）。 */
  skillDir: string;
  /**
   * 产物根目录，默认 `<skillDir>/dist`。
   * 实际 Skill 包会输出到 `<outDir>/<skill-name>/`，方便直接同步到 agent skills 目录。
   */
  outDir?: string;
  /** 入口文件，默认 `src/main.ts`。 */
  entry?: string;
  /** 是否压缩，默认 false。 */
  minify?: boolean;
  /**
   * sourcemap 策略：
   * - false（默认）：不生成 sourcemap，build 场景产物最干净；
   * - "inline"：内联到 main.mjs，dev 场景定位错误堆栈很有用；
   * - "external"：单独的 .map 文件。
   */
  sourcemap?: false | "inline" | "external";
}

export interface BuildResult {
  name: string;
  /** 产物根目录（即传入的 outDir）。 */
  outDir: string;
  /** Skill 包目录：`<outDir>/<name>/`。 */
  skillOutDir: string;
  /** 编译后的入口 JS：`<skillOutDir>/scripts/main.mjs`。 */
  bundleFile: string;
  /** 拷贝后的 SKILL.md：`<skillOutDir>/SKILL.md`。 */
  skillMdFile: string;
  /** 单文件 bundle 字节数。 */
  bundleBytes: number;
  /** SKILL.md 字节数。 */
  skillMdBytes: number;
  /** 拷贝的资源目录（references / assets）。 */
  copiedDirs: { name: string; files: number }[];
  /**
   * 触发该次回调的事件类型（仅 watch 模式下有意义）：
   * - `bundle`：esbuild 重编了 main.mjs
   * - `assets`：仅 SKILL.md / references / assets 同步，未重编 JS
   * 一次性 build 始终为 `bundle`。
   */
  kind: "bundle" | "assets";
}

const ESBUILD_BASE_OPTIONS = {
  bundle: true,
  platform: "node" as const,
  target: "node18",
  format: "esm" as const,
  charset: "utf8" as const,
  external: ["node:*"],
  logLevel: "silent" as const,
};

/** 需要 mirror 到 dist/<name>/ 的资源目录。 */
const MIRRORED_DIRS = ["references", "assets"] as const;

function resolveSourcemap(
  v: BuildOptions["sourcemap"],
): false | "inline" | "external" {
  return v ?? false;
}

/**
 * 把 SKILL.md / references / assets 同步到 dist/<name>/。
 * 抽成独立函数：build 末尾、watch 重编、SKILL.md / 资源文件单独变化时都会复用。
 */
async function syncSkillAssets(
  skillDir: string,
  skillOutDir: string,
): Promise<BuildResult["copiedDirs"]> {
  const skillMdPath = join(skillDir, "SKILL.md");
  await copyFile(skillMdPath, join(skillOutDir, "SKILL.md"));

  const copiedDirs: BuildResult["copiedDirs"] = [];
  for (const dir of MIRRORED_DIRS) {
    const srcDir = join(skillDir, dir);
    const destDir = join(skillOutDir, dir);
    if (!existsSync(srcDir)) {
      // 源目录被删了，把上一次拷贝过去的产物也清掉，保持一致
      await rm(destDir, { recursive: true, force: true });
      continue;
    }
    await rm(destDir, { recursive: true, force: true });
    const files = await copyDir(srcDir, destDir);
    copiedDirs.push({ name: dir, files });
  }
  return copiedDirs;
}

/**
 * 构建一个 Skill：
 *   1. esbuild 把 src/main.ts + 依赖打成 dist/<name>/scripts/main.mjs（ESM）
 *   2. 读取并校验 SKILL.md frontmatter
 *   3. 拷贝 SKILL.md → dist/<name>/SKILL.md
 *   4. mirror references/ assets/（如存在）到 dist/<name>/
 *
 * 产物目录形态（zip 友好，根目录与 Skill name 一致）：
 *   <outDir>/<name>/
 *   ├── SKILL.md
 *   ├── scripts/main.mjs
 *   ├── references/   （若源码有）
 *   └── assets/       （若源码有）
 */
export async function buildSkill(options: BuildOptions): Promise<BuildResult> {
  const skillDir = resolve(options.skillDir);
  const outDir = resolve(options.outDir ?? join(skillDir, "dist"));
  const entry = resolve(skillDir, options.entry ?? "src/main.ts");

  if (!existsSync(entry)) {
    throw new Error(`找不到入口文件: ${entry}`);
  }
  const skillMdPath = join(skillDir, "SKILL.md");
  if (!existsSync(skillMdPath)) {
    throw new Error(`找不到 SKILL.md: ${skillMdPath}`);
  }

  const meta = await parseSkillMd(skillMdPath);
  const skillOutDir = join(outDir, meta.name);

  // 仅清理本 Skill 自己的子目录与同名 zip，避免误删别的 Skill 产物（同 outDir 多 Skill 场景）。
  await rm(skillOutDir, { recursive: true, force: true });
  await mkdir(join(skillOutDir, "scripts"), { recursive: true });

  const bundleFile = join(skillOutDir, "scripts", "main.mjs");
  await esbuild({
    ...ESBUILD_BASE_OPTIONS,
    entryPoints: [entry],
    outfile: bundleFile,
    minify: options.minify ?? false,
    sourcemap: resolveSourcemap(options.sourcemap),
  });

  const skillMdOut = join(skillOutDir, "SKILL.md");
  const copiedDirs = await syncSkillAssets(skillDir, skillOutDir);

  const bundleStat = await stat(bundleFile);
  const mdStat = await stat(skillMdOut);

  return {
    name: meta.name,
    outDir,
    skillOutDir,
    bundleFile,
    skillMdFile: skillMdOut,
    bundleBytes: bundleStat.size,
    skillMdBytes: mdStat.size,
    copiedDirs,
    kind: "bundle",
  };
}

/**
 * watch 模式：监听两路变更，全部即时同步到 dist/<name>/：
 *   1. esbuild 监听 src/ 任意 import 链路上的 .ts/.js → 触发重编 + 资源同步
 *   2. fs.watch 递归监听 skillDir，白名单只放行 SKILL.md / references/** / assets/**
 *      —— src/、dist/、package.json、tsconfig.json 等噪音由白名单天然过滤掉
 *
 * 返回 dispose 函数，调用即可停止所有监听。
 */
export async function watchSkill(
  options: BuildOptions,
  onRebuild?: (result: BuildResult | null, error?: Error) => void,
): Promise<() => Promise<void>> {
  const skillDir = resolve(options.skillDir);
  const outDir = resolve(options.outDir ?? join(skillDir, "dist"));
  const entry = resolve(skillDir, options.entry ?? "src/main.ts");
  const skillMdPath = join(skillDir, "SKILL.md");

  // watch 启动时先解析一次 name，固定 skillOutDir（避免每次 onEnd 时重复 parse 出现竞态）。
  const initialMeta = await parseSkillMd(skillMdPath);
  const skillOutDir = join(outDir, initialMeta.name);

  await rm(skillOutDir, { recursive: true, force: true });
  await mkdir(join(skillOutDir, "scripts"), { recursive: true });
  const bundleFile = join(skillOutDir, "scripts", "main.mjs");

  // 把"重编 → 同步资源 → 回调"的流程抽出来，资源/SKILL.md 单独变更时也走它，保持产物一致。
  // kind 区分两条触发路径：esbuild onEnd 走 'bundle'，fs.watch 走 'assets'。
  const emitResult = async (kind: BuildResult["kind"]): Promise<void> => {
    try {
      const meta = await parseSkillMd(skillMdPath);
      const copiedDirs = await syncSkillAssets(skillDir, skillOutDir);
      const bundleStat = existsSync(bundleFile)
        ? await stat(bundleFile)
        : { size: 0 };
      const mdStat = await stat(join(skillOutDir, "SKILL.md"));
      onRebuild?.({
        name: meta.name,
        outDir,
        skillOutDir,
        bundleFile,
        skillMdFile: join(skillOutDir, "SKILL.md"),
        bundleBytes: bundleStat.size,
        skillMdBytes: mdStat.size,
        copiedDirs,
        kind,
      });
    } catch (err) {
      onRebuild?.(null, err as Error);
    }
  };

  const ctx = await esbuildContext({
    ...ESBUILD_BASE_OPTIONS,
    entryPoints: [entry],
    outfile: bundleFile,
    minify: options.minify ?? false,
    sourcemap: resolveSourcemap(options.sourcemap),
    plugins: [
      {
        name: "skill-kits-on-rebuild",
        setup(build) {
          build.onEnd(async (result) => {
            if (result.errors.length > 0) {
              onRebuild?.(
                null,
                new Error(
                  result.errors.map((e: { text: string }) => e.text).join("\n"),
                ),
              );
              return;
            }
            await emitResult("bundle");
          });
        },
      },
    ],
  });
  await ctx.watch();

  // fs.watch(skillDir, { recursive: true }) 一把梭：
  // 整个 Skill 目录递归监听，再用白名单过滤——只关心 SKILL.md / references/** / assets/**。
  // src/、dist/、package.json、tsconfig.json 等交给 esbuild 或直接忽略。
  // 80ms debounce 合并编辑器原子写引发的连发事件。
  let debounceTimer: NodeJS.Timeout | undefined;
  const scheduleSync = (): void => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      void emitResult("assets");
    }, 80);
  };

  const isWatched = (filename: string): boolean => {
    if (filename === "SKILL.md") return true;
    // path.sep 在 Windows 是 "\\"；fs.watch 给的 filename 用 OS 分隔符
    const top = filename.split(/[\\/]/, 1)[0] ?? "";
    return (MIRRORED_DIRS as readonly string[]).includes(top);
  };

  const dirWatcher = fsWatch(
    skillDir,
    { recursive: true },
    (_event, filename) => {
      if (!filename) return;
      if (isWatched(filename)) scheduleSync();
    },
  );

  return async () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    dirWatcher.close();
    await ctx.dispose();
  };
}

/** 递归拷贝目录，返回拷贝的文件数。 */
async function copyDir(src: string, dest: string): Promise<number> {
  await mkdir(dest, { recursive: true });
  let count = 0;
  const entries = await readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const s = join(src, entry.name);
    const d = join(dest, entry.name);
    if (entry.isDirectory()) {
      count += await copyDir(s, d);
    } else if (entry.isFile()) {
      await copyFile(s, d);
      count += 1;
    }
  }
  return count;
}

export { parseSkillMd } from "./skill-md.js";
export type { ParsedSkillMd } from "./skill-md.js";
