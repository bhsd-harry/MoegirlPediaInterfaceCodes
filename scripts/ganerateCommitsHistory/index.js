const bots = [
    "GH:github-actions",
    "GH:GitHub",
    "GH:GitHub Actions",
];

import console from "../modules/console.js";
import mailmapSet from "../modules/mailmapSet.js";
import { startGroup, endGroup, exportVariable } from "@actions/core";
import { isInMasterBranch } from "../modules/octokit.js";
import { git } from "../modules/git.js";
import { writeFile } from "../modules/jsonModule.js";
import createCommit from "../modules/createCommit.js";
if (!isInMasterBranch) {
    console.info("Not running in non-master branch, exit.");
    process.exit(0);
}
console.info("Initialization done.");
const { all: rawHistory } = await git.log({
    format: {
        hash: "%H",
        date: "%aI",
        committer_name: "%cN",
        committer_email: "%cE",
    },
});
startGroup("Raw history:");
console.info(rawHistory);
endGroup();
const history = {};
startGroup("Raw history parser:");
for (const { hash, date, committer_name, committer_email } of rawHistory) {
    console.info("Parsing:", { date, hash, committer_name, committer_email });
    const username = `${mailmapSet.includes(committer_email) ? "U:" : "GH:"}${committer_name}`;
    console.info("\tusername:", username);
    if (username.endsWith("[bot]") || bots.includes(username)) {
        console.info("\tThis commit came from a bot, skip.");
        continue;
    }
    if (!Array.isArray(history[username])) {
        history[username] = [];
    }
    history[username].push({
        commit: hash,
        datetime: date,
    });
}
endGroup();
startGroup("Parsed history:");
console.info(history);
endGroup();
await writeFile("src/global/zh/MediaWiki:GHIAHistory.json", history);
await createCommit("auto: commit history generated by ganerateCommitsHistory");
exportVariable("linguist-generated-generatePolyfill", JSON.stringify(["src/global/zh/MediaWiki:GHIAHistory.json"]));
console.info("Done.");
