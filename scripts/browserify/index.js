"use strict";
const console = require("../modules/console.js");
console.info("Start initialization...");
const mkdtmp = require("../modules/mkdtmp.js");
const browserify = require("browserify");
const minifyStream = require("minify-stream");
const uglify = require("uglify-js");
const browserifyTargets = require("./targets.js");
const fs = require("fs");
const path = require("path");
const core = require("@actions/core");

(async () => {
    console.info("browserifyTargets:", browserifyTargets);
    const tempPath = await mkdtmp(true);
    const inputPath = path.join(tempPath, "input.js");
    core.exportVariable("linguist-generated-browserify", JSON.stringify(browserifyTargets.map(({ file }) => file)));
    for (const browserifyTarget of browserifyTargets) {
        console.info("target:", browserifyTarget);
        const { module, entry, file, exports, removePlugins, prependCode } = browserifyTarget;
        await fs.promises.rm(inputPath, {
            recursive: true,
            force: true,
        });
        const hasExports = Array.isArray(exports) && exports.length > 0;
        const reference = hasExports ? `{ ${exports.join(", ")} }` : "m";
        await fs.promises.writeFile(inputPath, [
            `import ${reference} from "${module}";`,
            `global["${entry}"] = ${reference};`,
        ].join("\n"));
        const codes = await new Promise((res, rej) => {
            console.info(`[${module}]`, "start generating...");
            const plugins = new Set([
                "esmify",
                "common-shakeify",
                "browser-pack-flat/plugin",
            ]);
            if (Array.isArray(removePlugins)) {
                for (const removePlugin of removePlugins) {
                    plugins.delete(removePlugin);
                }
            }
            let codeObject = browserify(inputPath).transform("unassertify", { global: true }).transform("envify", { global: true });
            for (const plugin of plugins) {
                codeObject = codeObject.plugin(plugin);
            }
            const codeStream = codeObject.bundle().pipe(minifyStream({
                sourceMap: false,
                uglify,
                mangle: false,
                output: {
                    beautify: true,
                    width: 1024 * 10,
                },
            }));
            const chunks = [];
            codeStream.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
            codeStream.on("error", (err) => rej(err));
            codeStream.on("end", () => res(Buffer.concat(chunks).toString("utf8")));
        });
        const output = [
            "/**",
            " * Generated by scripts/browserify/index.js",
            " * Options:",
        ];
        for (const [k, v] of Object.entries(browserifyTarget)) {
            output.push(` *     ${k}: ${JSON.stringify(v, null, 1).replace(/\n */g, " ")}`);
        }
        output.push(" */");
        if (typeof prependCode === "string") {
            output.push(prependCode);
        }
        output.push(codes.trim(), "");
        await fs.promises.rm(file, {
            recursive: true,
            force: true,
        });
        await fs.promises.writeFile(file, output.join("\n"));
        if (path.extname(file) === ".js") {
            const filename = path.basename(file);
            const eslintrcName = path.join(path.dirname(file), ".eslintrc");
            const eslintrc = JSON.parse(await fs.promises.readFile(eslintrcName, "utf-8").catch(() => "{}"));
            if (!Array.isArray(eslintrc.ignorePatterns)) {
                eslintrc.ignorePatterns = [];
            }
            if (!eslintrc.ignorePatterns.includes(filename)) {
                eslintrc.ignorePatterns.push(filename);
                await fs.promises.writeFile(eslintrcName, JSON.stringify(eslintrc, null, 4));
            }
        }
        console.info(`[${module}]`, "generated successfully.");
    }
    console.info("Done.");
    process.exit(0);
})();
