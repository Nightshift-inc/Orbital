import type { Octokit } from "octokit";

export interface ToolDef {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
  handler: (args: any) => Promise<string>;
}

export interface ToolDeps {
  octokit: Octokit;
  owner: string;
  repo: string;
  workspace: string;
  cloneToken?: string;
}

export type ToolFactory = (deps: ToolDeps) => ToolDef;
