export interface PR {
  number: number;
  title: string;
  author: string;
  state: string;
  merged_at: string | null;
  created_at: string;
  updated_at: string;
  url: string;
  body: string;
  changed_files: number;
  additions: number;
  deletions: number;
  labels: string[];
  files: string[];
}

export async function getRecentPRs(repo: string, limit = 10): Promise<PR[]> {
  const [owner, name] = repo.split("/");
  if (!owner || !name) throw new Error(`Invalid repo format: "${repo}". Expected "owner/repo".`);

  const token = process.env.GITHUB_TOKEN;
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "orbital-incident-agent",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(
    `https://api.github.com/repos/${owner}/${name}/pulls?state=closed&sort=updated&direction=desc&per_page=${limit}`,
    { headers }
  );

  if (!res.ok) {
    throw new Error(`GitHub API error ${res.status}: ${await res.text()}`);
  }

  const prs: any[] = await res.json();

  // Fetch changed files for each PR in parallel (up to 5 files per PR shown)
  const enriched = await Promise.all(
    prs.map(async (pr: any) => {
      let files: string[] = [];
      try {
        const filesRes = await fetch(
          `https://api.github.com/repos/${owner}/${name}/pulls/${pr.number}/files?per_page=20`,
          { headers }
        );
        if (filesRes.ok) {
          const filesData: any[] = await filesRes.json();
          files = filesData.map((f: any) => f.filename);
        }
      } catch {
        // best-effort
      }

      return {
        number: pr.number as number,
        title: pr.title as string,
        author: (pr.user?.login ?? "unknown") as string,
        state: pr.state as string,
        merged_at: pr.merged_at as string | null,
        created_at: pr.created_at as string,
        updated_at: pr.updated_at as string,
        url: pr.html_url as string,
        body: ((pr.body ?? "") as string).slice(0, 500),
        changed_files: (pr.changed_files ?? 0) as number,
        additions: (pr.additions ?? 0) as number,
        deletions: (pr.deletions ?? 0) as number,
        labels: ((pr.labels ?? []) as any[]).map((l: any) => l.name as string),
        files,
      } satisfies PR;
    })
  );

  return enriched;
}
