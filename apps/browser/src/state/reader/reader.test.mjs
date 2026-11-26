import assert from "node:assert/strict";
import { test } from "node:test";
import { extractArticle } from "./extractArticle.ts";

function matches(node, simple) {
  const s = simple.trim();
  const tag = /^[a-zA-Z][a-zA-Z0-9]*/.exec(s)?.[0];
  if (tag && node.tagName.toLowerCase() !== tag) return false;
  const cls = /\.([a-zA-Z0-9_-]+)/.exec(s)?.[1];
  if (cls && !node.className.split(/\s+/).includes(cls)) return false;
  const attr = /\[([^\]=]+)(?:=([^\]]+))?\]/.exec(s);
  if (attr) {
    const value = node.getAttribute(attr[1]);
    if (attr[2] === undefined ? value === null : value !== attr[2]) return false;
  }
  if (!tag && !cls && !attr) return false;
  return true;
}

function el(tag, { text = "", cls = "", id = "", children = [], attrs = {} } = {}) {
  const node = {
    tagName: tag.toUpperCase(),
    textContent: text,
    className: cls,
    id,
    parentElement: null,
    children,
    getAttribute: (name) => attrs[name] ?? null,
    querySelectorAll(sel) {
      const out = [];
      const walk = (n) => {
        for (const c of n.children) {
          if (sel.split(",").some((s) => matches(c, s))) out.push(c);
          walk(c);
        }
      };
      walk(node);
      return out;
    },
    closest(sel) {
      let cur = node.parentElement;
      while (cur) {
        if (sel.split(",").some((s) => matches(cur, s))) return cur;
        cur = cur.parentElement;
      }
      return null;
    },
  };
  for (const c of children) c.parentElement = node;
  return node;
}

function docWith(body, title = "Article", hostname = "example.com") {
  const root = el("html", { children: [el("head", {}), body] });
  body.parentElement = root;
  const doc = {
    title,
    location: { hostname },
    querySelector: (sel) => doc.querySelectorAll(sel)[0] ?? null,
    querySelectorAll: (sel) => {
      const out = [];
      const walk = (n) => {
        for (const c of n.children) {
          if (sel.split(",").some((s) => matches(c, s))) out.push(c);
          walk(c);
        }
      };
      walk(root);
      return out;
    },
  };
  return doc;
}

const LOREM = "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.";

test("extracts an article, skips nav and ads", () => {
  const article = el("article", {
    children: [
      el("h1", { text: "The Big Story" }),
      el("p", { text: LOREM }),
      el("p", { text: LOREM }),
      el("p", { text: LOREM }),
      el("p", { text: LOREM }),
      el("p", { text: LOREM }),
      el("div", { cls: "ad-banner", children: [el("p", { text: LOREM })] }),
      el("blockquote", { text: "A wise person once said something worth quoting here." }),
    ],
  });
  const body = el("body", {
    children: [
      el("nav", { children: [el("p", { text: LOREM })] }),
      article,
      el("aside", { children: [el("p", { text: LOREM })] }),
    ],
  });
  const found = extractArticle(docWith(body, "The Big Story | Example News"));
  assert.ok(found);
  assert.equal(found.title, "The Big Story");
  assert.equal(found.siteName, "example.com");
  assert.equal(found.blocks.filter((b) => b.kind === "p").length, 5);
  assert.equal(found.blocks.filter((b) => b.kind === "quote").length, 1);
});

test("returns null when the page has too little text", () => {
  const body = el("body", { children: [el("div", { children: [el("p", { text: "Short." })] })] });
  assert.equal(extractArticle(docWith(body, "Tiny")), null);
});

test("falls back to the largest text container when there is no article tag", () => {
  const main = el("div", {
    children: [el("p", { text: LOREM }), el("p", { text: LOREM }), el("p", { text: LOREM }), el("p", { text: LOREM }), el("p", { text: LOREM })],
  });
  const body = el("body", { children: [main] });
  const found = extractArticle(docWith(body, "No Article Tag Here"));
  assert.ok(found);
  assert.equal(found.blocks.filter((b) => b.kind === "p").length, 5);
});

test("picks up the byline from a meta author tag", () => {
  const meta = el("meta", { attrs: { name: "author", content: "Ada Lovelace" } });
  const article = el("article", {
    children: [el("p", { text: LOREM }), el("p", { text: LOREM }), el("p", { text: LOREM }), el("p", { text: LOREM }), el("p", { text: LOREM })],
  });
  const body = el("body", { children: [meta, article] });
  const found = extractArticle(docWith(body, "Byline Test"));
  assert.ok(found);
  assert.equal(found.byline, "Ada Lovelace");
});
