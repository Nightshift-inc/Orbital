import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import type { ToolFactory } from "./types.js";

export const makeGetServiceMap: ToolFactory = () => ({
  name: "get_service_map",
  description:
    "Build a service map from a checked-out repo. Walks the tree (depth-limited) detecting service manifests (package.json, pyproject.toml, requirements.txt, go.mod, Cargo.toml, Dockerfile, pom.xml, build.gradle) and emits one node per service with detected language, manifest path, and (when available) declared dependencies. Run checkout_repo first.",
  parameters: {
    type: "object",
    properties: {
      repoPath: { type: "string", description: "Local path returned by checkout_repo." },
      maxDepth: { type: "number", description: "Max directory depth to scan (default 4)." },
    },
    required: ["repoPath"],
  },
  handler: async (args: { repoPath: string; maxDepth?: number }) => {
    const root = args.repoPath;
    const maxDepth = args.maxDepth ?? 4;
    if (!existsSync(root)) return `Path not found: ${root}`;

    const skip = new Set([
      "node_modules",
      ".git",
      "dist",
      "build",
      "target",
      ".next",
      ".venv",
      "venv",
      "__pycache__",
      ".cache",
      "vendor",
    ]);

    type Service = {
      name: string;
      path: string;
      manifest: string;
      language: string;
      dependencies?: string[];
    };
    const services: Service[] = [];

    const detect = (dir: string, depth: number): void => {
      let entries: string[];
      try {
        entries = readdirSync(dir);
      } catch {
        return;
      }
      const has = (f: string) => entries.includes(f);
      const rel = dir.startsWith(root) ? dir.slice(root.length).replace(/^\//, "") || "." : dir;
      const name = rel === "." ? basename(root) : rel;
      let foundHere = false;

      if (has("package.json")) {
        try {
          const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf-8"));
          services.push({
            name: pkg.name || name,
            path: rel,
            manifest: "package.json",
            language: "javascript/typescript",
            dependencies: Object.keys(pkg.dependencies || {}),
          });
          foundHere = true;
        } catch {}
      }
      if (has("pyproject.toml") || has("requirements.txt") || has("setup.py")) {
        const manifest = has("pyproject.toml")
          ? "pyproject.toml"
          : has("requirements.txt")
            ? "requirements.txt"
            : "setup.py";
        services.push({ name, path: rel, manifest, language: "python" });
        foundHere = true;
      }
      if (has("go.mod")) {
        services.push({ name, path: rel, manifest: "go.mod", language: "go" });
        foundHere = true;
      }
      if (has("Cargo.toml")) {
        services.push({ name, path: rel, manifest: "Cargo.toml", language: "rust" });
        foundHere = true;
      }
      if (has("pom.xml") || has("build.gradle") || has("build.gradle.kts")) {
        const manifest = has("pom.xml")
          ? "pom.xml"
          : has("build.gradle")
            ? "build.gradle"
            : "build.gradle.kts";
        services.push({ name, path: rel, manifest, language: "jvm" });
        foundHere = true;
      }
      if (has("Dockerfile") && !foundHere) {
        services.push({ name, path: rel, manifest: "Dockerfile", language: "container" });
      }

      if (depth >= maxDepth) return;
      for (const e of entries) {
        if (skip.has(e) || e.startsWith(".")) continue;
        const sub = join(dir, e);
        let st;
        try {
          st = statSync(sub);
        } catch {
          continue;
        }
        if (st.isDirectory()) detect(sub, depth + 1);
      }
    };

    detect(root, 0);

    if (services.length === 0) return "No services detected.";

    const nameSet = new Set(services.map((s) => s.name));
    const edges: Array<{ from: string; to: string }> = [];
    for (const s of services) {
      if (!s.dependencies) continue;
      for (const dep of s.dependencies) {
        if (nameSet.has(dep)) edges.push({ from: s.name, to: dep });
      }
    }

    return JSON.stringify({ services, edges }, null, 2);
  },
});
