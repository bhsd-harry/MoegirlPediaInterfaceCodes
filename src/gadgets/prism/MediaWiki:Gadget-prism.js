"use strict";
(() => {
    window.Prism = { manual: true };
    const workerJS = (config) => {
        self.importScripts("https://testingcf.jsdelivr.net/npm/wikiparser-node@1.7.0-beta.0/bundle/bundle.min.js");
        self.Parser.config = JSON.parse(config);
        const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;" },
            keyword = 'keyword',
            url = 'url',
            bold = 'bold',
            doctype = 'doctype',
            comment = 'comment',
            tag = 'tag',
            punctuation = 'punctuation',
            variable = 'variable',
            builtin = 'builtin',
            template = 'function',
            symbol = 'symbol',
            selector = 'selector',
            string = 'string',
            map = {
				'redirect-syntax': keyword,
				'redirect-target': url,
				'link-target': `${url} ${bold}`,
				noinclude: doctype,
				include: doctype,
				comment,
				ext: tag,
				'ext-attr-dirty': comment,
				'ext-attr': punctuation,
				'attr-key': 'attr-name',
				'attr-value': 'attr-value',
				arg: variable,
				'arg-name': variable,
				hidden: comment,
				'magic-word': builtin,
				'magic-word-name': builtin,
				'invoke-function': template,
				'invoke-module': template,
				template,
				'template-name': `${template} ${bold}`,
				parameter: punctuation,
				'parameter-key': variable,
				heading: symbol,
				'heading-title': bold,
				html: tag,
				'html-attr-dirty': comment,
				'html-attr': punctuation,
				table: symbol,
				tr: symbol,
				td: symbol,
				'table-syntax': symbol,
				'table-attr-dirty': comment,
				'table-attr': punctuation,
				'table-inter': 'deleted',
				hr: symbol,
				'double-underscore': 'constant',
				link: url,
				category: url,
				file: url,
				'gallery-image': url,
				'imagemap-image': url,
				'image-parameter': keyword,
				quote: `${symbol} ${bold}`,
				'ext-link': url,
				'ext-link-url': url,
				'free-ext-link': url,
				list: symbol,
				dd: symbol,
				converter: selector,
				'converter-flags': punctuation,
				'converter-flag': string,
				'converter-rule': punctuation,
				'converter-rule-variant': string,
            };
        self.onmessage = ({ data }) => {
            const { code } = JSON.parse(data),
                tree = self.Parser.parse(code).json();
            const slice = (type, parentType, start, end) => {
                const text = code.slice(start, end).replace(/[&<>]/g, (p) => entities[p]);
                let t = type || parentType;
                if (parentType === "image-parameter") {
                    t = "root";
				} else if (type === 'converter' && text === ';') {
					t = 'converter-rule';
                }
                return Reflect.has(map, t) ? `<span class="token ${map[t]}">${text}</span>` : text;
            };
            const stack = [];
            let cur = tree,
                index = 0,
                last = 0,
                out = false,
                output = "";
            while (last < code.length) {
                const { type, range: [, to], childNodes } = cur,
                    parentNode = stack[0]?.[0];
                if (out || !childNodes?.length) {
                    const [, i] = stack[0];
                    if (last < to) {
                        output += slice(type, parentNode.type, last, to);
                        last = to;
                    }
                    index++;
                    if (index === parentNode.childNodes.length) {
                        cur = parentNode;
                        index = i;
                        stack.shift();
                        out = true;
                    } else {
                        cur = parentNode.childNodes[index];
                        out = false;
                        const { range: [from] } = cur;
                        if (last < from) {
                            output += slice(parentNode.type, stack[1]?.[0].type, last, from);
                            last = from;
                        }
                    }
                } else {
                    const child = childNodes[0],
                        { range: [from] } = child;
                    if (last < from) {
                        output += slice(type, parentNode?.type, last, from);
                        last = from;
                    }
                    stack.unshift([cur, index]);
                    cur = child;
                    index = 0;
                }
            }
            postMessage(output);
            close();
        };
    };
    const alias = {
            "sanitized-css": "css",
            scribunto: "lua",
            wikitext: "wiki",
            mediawiki: "wiki",
            mw: "wiki",
        },
        contentModel = mw.config.get("wgPageContentModel").toLowerCase(),
        regexAlias = new RegExp(`\\blang(?:uage)?-(${Object.keys(alias).join("|")})\\b`, "iu");
    const main = async ($content) => {
        if (contentModel === "wikitext") {
            $content.find("pre[class*=lang-], pre[class*=language-], code[class*=lang-], code[class*=language-]")
                .prop(
                    'className',
                    (__, className) => className.replace(regexAlias, (_, lang) => `lang-${alias[lang]}`)
                        .replace(/\blinenums\b/u, "line-numbers"),
                );
            $content.find("pre[lang], code.prettyprint[lang]").addClass(function () {
                const lang = this.lang.toLowerCase();
                return `${this.tagName === "PRE" ? "line-numbers " : ""}lang-${alias[lang] ?? lang}`;
            });
        } else {
            $content.find(".mw-code").addClass(`line-numbers lang-${alias[contentModel] || contentModel}`);
        }
        const $block = $content.find("pre, code").filter((_, { className }) => /\blang(?:uage)?-/iu.test(className));
        if ($block.length === 0) {
            return;
        }
        const src = "https://testingcf.jsdelivr.net/npm/prismjs/plugins/autoloader/prism-autoloader.min.js";
        Object.assign(Prism.util, {
            currentScript: () => ({
                src,
                getAttribute: () => null,
            }),
        });
        if (!Prism.languages.wiki && $block.filter(".lang-wiki, .language-wiki").length) {
            const config = JSON.stringify(
                    await (await fetch("/MediaWiki:Gadget-prism.json?action=raw&ctype=application/json")).json(),
                ),
                filename = URL.createObjectURL(
                    new Blob([`(${String(workerJS)})('${config}')`], { type: "text/javascript" }),
                );
            Object.assign(Prism, { filename });
            Prism.languages.wiki ||= {};
        }
        $block.filter("pre").wrapInner("<code>").children("code").add($block.filter("code"))
            .each((_, code) => {
                const lang = Prism.util.getLanguage(code);
                const callback = () => {
                    let hash = /^#L\d+$/u.test(location.hash);
                    const { dataset: { start = 1 } } = code.parentElement;
                    $(code).children(".line-numbers-rows").children().each((i, ele) => {
                        ele.id = `L${i + Number(start)}`;
                        if (hash && location.hash === `#${ele.id}`) {
                            hash = false;
                            ele.scrollIntoView();
                        }
                    });
                };
                if (lang === "wiki") {
                    Prism.highlightElement(code, true, callback);
                } else {
                    Prism.highlightElement(code);
                    callback();
                }
            });
    };

    mw.hook("wikipage.content").add(($content) => {
        void main($content);
    });
})();
// </pre>
