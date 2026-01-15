import type { ContextProvider } from "../types.js";
import { ensureContext, truncateText } from "../utils.js";
import { updateRateLimit } from "../../github-rate-limit.js";

export const llmTxtProvider: ContextProvider = {
  name: "llm-txt",
  async run({ octokit, repos, config, rateLimit }) {
    if (!config.context.includeLlmTxt) return;
    const llmFiles = config.context.llmFiles?.length
      ? config.context.llmFiles
      : ["llms.txt", "llm.txt"];

    for (const repo of repos) {
      for (const fileName of llmFiles) {
        try {
          const response = await octokit.repos.getContent({
            owner: config.github.owner,
            repo: repo.repo.name,
            path: fileName
          });
          updateRateLimit(rateLimit, response.headers as Record<string, string>);

          if (!("content" in response.data)) continue;
          const content = Buffer.from(response.data.content, "base64").toString(
            "utf8"
          );
          const text = truncateText(content, config.context.maxLlmTxtBytes);
          const context = ensureContext(repo);
          context.overview = context.overview ?? {};
          context.overview.llmTxt = text;
          break;
        } catch (error) {
          const status = (error as { status?: number }).status;
          if (status === 404) continue;
          throw error;
        }
      }
    }
  }
};
