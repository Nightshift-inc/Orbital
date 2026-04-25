export interface ServiceNode {
  id: string;
  name: string;
  language: string;
  files: string[];
}

export interface DependencyEdge {
  from: string;
  to: string;
  via: string;
}

export interface ServiceMap {
  nodes: ServiceNode[];
  edges: DependencyEdge[];
  repo?: string;
  source: "github" | "demo";
}

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".py", ".go", ".rs", ".java"]);
const SKIP_DIRS = new Set([
  "node_modules", "dist", "build", ".git", "docs", "scripts", "coverage",
  "__tests__", ".next", ".nuxt", "vendor", "target",
]);

function detectLanguage(files: string[]): string {
  const counts: Record<string, number> = { typescript: 0, javascript: 0, python: 0, go: 0, rust: 0, java: 0 };
  for (const f of files) {
    if (f.endsWith(".ts") || f.endsWith(".tsx")) counts["typescript"]!++;
    else if (f.endsWith(".js") || f.endsWith(".jsx")) counts["javascript"]!++;
    else if (f.endsWith(".py")) counts["python"]!++;
    else if (f.endsWith(".go")) counts["go"]!++;
    else if (f.endsWith(".rs")) counts["rust"]!++;
    else if (f.endsWith(".java")) counts["java"]!++;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "unknown";
}

function parseImports(content: string): string[] {
  const imports: string[] = [];
  const importRegex = /(?:import|require|from)\s+['"]([^'"]+)['"]/g;
  let match: RegExpExecArray | null;
  while ((match = importRegex.exec(content)) !== null) {
    if (match[1]) imports.push(match[1]);
  }
  return imports;
}

export async function getServiceMap(repo: string, ref = "HEAD"): Promise<ServiceMap> {
  const [owner, name] = repo.split("/");
  if (!owner || !name) throw new Error(`Invalid repo format: "${repo}". Expected "owner/repo".`);

  const token = process.env.GITHUB_TOKEN;
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "orbital-incident-agent",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  // 1. Fetch the full recursive tree
  const treeRes = await fetch(
    `https://api.github.com/repos/${owner}/${name}/git/trees/${ref}?recursive=1`,
    { headers }
  );

  if (!treeRes.ok) {
    throw new Error(`GitHub API error ${treeRes.status}: ${await treeRes.text()}`);
  }

  const treeData: any = await treeRes.json();
  const allFiles: string[] = (treeData.tree as any[])
    .filter((item: any) => item.type === "blob")
    .map((item: any) => item.path as string);

  // 2. Group by top-level directory — each dir = a service
  const dirFiles = new Map<string, string[]>();

  for (const file of allFiles) {
    const parts = file.split("/");
    if (parts.length < 2) continue;

    const topDir = parts[0]!;
    if (topDir.startsWith(".") || SKIP_DIRS.has(topDir)) continue;

    const ext = "." + (file.split(".").pop() ?? "");
    if (!SOURCE_EXTENSIONS.has(ext)) continue;

    if (!dirFiles.has(topDir)) dirFiles.set(topDir, []);
    dirFiles.get(topDir)!.push(file);
  }

  // 3. Build service nodes (only dirs with source files)
  const nodes: ServiceNode[] = [];
  for (const [dir, files] of dirFiles) {
    if (files.length === 0) continue;
    nodes.push({
      id: dir,
      name: dir,
      language: detectLanguage(files),
      files: files.slice(0, 30),
    });
  }

  if (nodes.length < 2) {
    throw new Error(
      `Only ${nodes.length} service(s) found in "${repo}". ` +
      `The repo may use a monorepo layout (e.g. services/, packages/) that needs the subdirectory to be specified.`
    );
  }

  // 4. For each service pick entry file, fetch content, parse imports
  const serviceIds = new Set(nodes.map((n) => n.id));
  const edges: DependencyEdge[] = [];

  await Promise.all(
    nodes.map(async (service) => {
      const entryFile =
        service.files.find((f) =>
          /\/(index|main|app|server)\.(ts|tsx|js|jsx|py|go)$/.test(f)
        ) ?? service.files[0];

      if (!entryFile) return;

      try {
        const contentRes = await fetch(
          `https://api.github.com/repos/${owner}/${name}/contents/${entryFile}`,
          { headers }
        );
        if (!contentRes.ok) return;

        const contentData: any = await contentRes.json();
        // GitHub returns base64-encoded content
        const content = atob((contentData.content as string).replace(/\n/g, ""));
        const imports = parseImports(content);

        for (const importPath of imports) {
          for (const otherId of serviceIds) {
            if (otherId === service.id) continue;
            if (
              importPath.includes(`/${otherId}/`) ||
              importPath.includes(`@${otherId}`) ||
              importPath === otherId ||
              importPath.startsWith(`../${otherId}`)
            ) {
              // Avoid duplicates within this service's scan
              const alreadyAdded = edges.some(
                (e) => e.from === service.id && e.to === otherId
              );
              if (!alreadyAdded) {
                edges.push({ from: service.id, to: otherId, via: importPath });
              }
            }
          }
        }
      } catch {
        // best-effort; skip on failure
      }
    })
  );

  return { nodes, edges, repo, source: "github" };
}
