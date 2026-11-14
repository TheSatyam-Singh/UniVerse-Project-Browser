import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildPlan,
  classifyWithProvider,
  duplicatesIn,
  fittedTitle,
  pageKey,
  registrableDomain,
  rulesGroups,
  rulesRenames,
  sameTopic,
  siteTitleFor,
} from "./tabOrganizer.ts";

const input = (index, title, url) => ({ index, id: `tab-${index}`, title, url });

test("page keys ignore scheme, www and a trailing slash", () => {
  assert.equal(pageKey("https://www.example.com/a/"), pageKey("http://example.com/a"));
  assert.notEqual(pageKey("https://example.com/a?x=1"), pageKey("https://example.com/a?x=2"));
});

test("duplicates keep the first tab and also match already-filed pages", () => {
  const inputs = [
    input(1, "A", "https://example.com/page"),
    input(2, "B", "http://www.example.com/page/"),
    input(3, "C", "https://other.com/page"),
  ];
  assert.deepEqual(duplicatesIn(inputs), [2]);
  assert.deepEqual(duplicatesIn(inputs, ["https://other.com/page"]), [2, 3]);
});

test("sameTopic needs every word of the shorter name in the longer one", () => {
  assert.equal(sameTopic("3D Printing", "3D Printing Models"), true);
  assert.equal(sameTopic("Home Finance", "Home Automation"), false);
  assert.equal(sameTopic("Sourdough", "Sourdough Bread"), true);
});

test("registrable domains collapse subdomains and strip www", () => {
  assert.equal(registrableDomain("https://news.bbc.co.uk/sport"), "bbc.co.uk");
  assert.equal(registrableDomain("https://www.github.com/x"), "github.com");
  assert.equal(registrableDomain("not a url"), "");
});

test("site titles come from the front page segment naming the site", () => {
  assert.equal(siteTitleFor(input(1, "BBC News - Breaking news, video", "https://www.bbc.com/news")), "BBC News");
  assert.equal(siteTitleFor(input(2, "Some deep article about bread", "https://example.com/beginners-sourdough-bread")), null);
});

test("fitted titles cut at a clause or word boundary and drop dangling words", () => {
  assert.equal(fittedTitle("Refinance: What It Is, How It Works And When To Consider It"), "Refinance");
  assert.equal(fittedTitle("A Very Long Tab Title About Something With Many Words"), "A Very Long Tab Title");
  assert.equal(fittedTitle("Short title"), "Short title");
});

test("rules grouping files same-domain tabs sharing a title word and drops singletons", () => {
  const inputs = [
    input(1, "Sourdough starter guide", "https://www.kingarthurbaking.com/starter"),
    input(2, "Sourdough bread recipe", "https://www.kingarthurbaking.com/recipe"),
    input(3, "Inbox - Mail", "https://mail.google.com/inbox"),
    input(4, "Sourdough scoring tips", "https://www.bonappetit.com/scoring"),
  ];
  const groups = rulesGroups(inputs);
  assert.equal(groups.length, 1);
  assert.deepEqual(groups[0].tabs, [1, 2]);
  assert.equal(groups[0].name, "Sourdough");
});

test("rules grouping files into an existing folder on the same topic", () => {
  const inputs = [
    input(1, "Sourdough starter guide", "https://www.kingarthurbaking.com/starter"),
    input(2, "Sourdough bread recipe", "https://www.kingarthurbaking.com/recipe"),
  ];
  const groups = rulesGroups(inputs, [{ id: "f1", name: "Sourdough Baking", sampleTitles: [] }]);
  assert.equal(groups[0].existingFolderId, "f1");
  assert.equal(groups[0].name, "Sourdough Baking");
});

test("rules renames shorten long titles and leave short ones alone", () => {
  const renames = rulesRenames([
    input(1, "BBC News - Breaking news, video and headlines from around the world", "https://www.bbc.com/news"),
    input(2, "Short", "https://example.com/"),
  ]);
  assert.equal(renames.length, 1);
  assert.equal(renames[0].tab, 1);
  assert.equal(renames[0].name.length <= 24, true);
});

test("buildPlan drops generic names, one-tab groups, unknown tabs and renames that are not shorter", () => {
  const inputs = [input(1, "Alpha page about cats", "https://a.example.com/1"), input(2, "Beta page about cats", "https://a.example.com/2")];
  const plan = buildPlan(
    inputs,
    [
      { name: "General", tabs: [1, 2] },
      { name: "Cats", tabs: [1, 2] },
      { name: "Solo", tabs: [1] },
      { name: "Ghost", tabs: [9, 10] },
    ],
    [
      { tab: 1, name: "Alpha page about cats" },
      { tab: 2, name: "Beta cats" },
    ],
    [2, 99],
  );
  assert.equal(plan.groups.length, 1);
  assert.equal(plan.groups[0].name, "Cats");
  assert.deepEqual(plan.groups[0].tabs, [1, 2]);
  assert.deepEqual(plan.renames, [{ tab: 2, name: "Beta cats" }]);
  assert.deepEqual(plan.duplicates, [2]);
});

test("provider classification parses JSON groups and sanitises them with the same rules", async () => {
  const inputs = [
    input(1, "Sourdough starter guide", "https://baking.example.com/starter"),
    input(2, "Sourdough bread recipe", "https://baking.example.com/recipe"),
    input(3, "Inbox", "https://mail.example.com/inbox"),
  ];
  const chat = async () => ({
    content: JSON.stringify({
      groups: [
        { name: "Sourdough", tabs: [1, 2] },
        { name: "Misc", tabs: [3] },
      ],
      renames: [{ tab: 1, name: "Sourdough starter" }],
    }),
    toolCalls: [],
    citations: [],
    finishReason: "stop",
  });
  const { groups, renames } = await classifyWithProvider(inputs, [], "test-model", chat);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].name, "Sourdough");
  assert.deepEqual(groups[0].tabs, [1, 2]);
  assert.deepEqual(renames, [{ tab: 1, name: "Sourdough starter" }]);
});

test("provider classification returns nothing when the model does not answer JSON", async () => {
  const chat = async () => ({ content: "I cannot group these.", toolCalls: [], citations: [], finishReason: "stop" });
  const out = await classifyWithProvider([input(1, "A", "https://example.com/")], [], "m", chat);
  assert.deepEqual(out, { groups: [], renames: [] });
});
