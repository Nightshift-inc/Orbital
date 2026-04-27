import { makeCheckoutRepo } from "./checkout-repo.js";
import { makeFindPrForCommit } from "./find-pr-for-commit.js";
import { makeGetAppErrors } from "./get-app-errors.js";
import { makeGetDeployLog } from "./get-deploy-log.js";
import { makeGetRecentPrs } from "./get-recent-prs.js";
import { makeGetServiceMap } from "./get-service-map.js";
import { makeGithubSearch } from "./github-search.js";
import { makeGitLog } from "./git-log.js";
import { makeRipgrep } from "./ripgrep.js";
import type { ToolDef, ToolDeps } from "./types.js";

export type { ToolDef, ToolDeps, ToolFactory } from "./types.js";

export function buildInvestigationTools(deps: ToolDeps): ToolDef[] {
  return [
    makeGithubSearch(deps),
    makeCheckoutRepo(deps),
    makeRipgrep(deps),
    makeGitLog(deps),
    makeFindPrForCommit(deps),
    makeGetRecentPrs(deps),
    makeGetDeployLog(deps),
    makeGetAppErrors(deps),
    makeGetServiceMap(deps),
  ];
}
