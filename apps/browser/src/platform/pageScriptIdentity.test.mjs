import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const script = readFileSync(new URL("../../../../packages/universecore/ios/page_script.js", import.meta.url), "utf8");
const slice = (from, to) => {
  const start = script.indexOf(from);
  const end = script.indexOf(to, start);
  assert.ok(start > 0 && end > start, `page_script.js has ${from.trim()}`);
  return script.slice(start, end);
};
const helper = slice("  const asNative = ", "  const { keys, setPrototypeOf } = Object;\n");
const maskStart = script.indexOf("  try {\n    const chromeToken = ");
const maskEnd = script.indexOf("  } catch (e) {}", maskStart) + "  } catch (e) {}".length;
const masking = script.slice(maskStart, maskEnd);

const CHROME_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36";

function chromePage() {
  class Navigator {}
  Object.defineProperty(Navigator.prototype, "userAgent", {
    get() {
      return CHROME_UA;
    },
    configurable: true,
  });
  Object.defineProperty(Navigator.prototype, "vendor", {
    get() {
      return "Google Inc.";
    },
    configurable: true,
  });
  const brands = [
    { brand: "Chromium", version: "157" },
    { brand: "Google Chrome", version: "157" },
    { brand: "Not-A.Brand", version: "99" },
  ];
  const fullVersionList = [
    { brand: "Chromium", version: "157.0.0.0" },
    { brand: "Google Chrome", version: "157.0.0.0" },
    { brand: "Not-A.Brand", version: "99.0.0.0" },
  ];
  const userAgentData = {
    brands,
    mobile: false,
    platform: "macOS",
    getHighEntropyValues: async () => ({ brands, fullVersionList, platform: "macOS", mobile: false }),
  };
  Object.defineProperty(Navigator.prototype, "userAgentData", {
    get() {
      return userAgentData;
    },
    configurable: true,
  });
  const navigator = new Navigator();
  const window = { chrome: { runtime: {} } };
  const run = new Function(
    "navigator",
    "window",
    "Navigator",
    `const isArray = Array.isArray;\n${helper}${masking}`,
  );
  run(navigator, window, Navigator);
  return { navigator, window, userAgentData };
}

test("identity: window.chrome is hidden, the UA and vendor read UniVerse, client hints lose Chromium", async () => {
  const { navigator, window } = chromePage();
  assert.equal(window.chrome, undefined);
  assert.equal(navigator.userAgent.includes("Chrome/"), false);
  assert.ok(navigator.userAgent.includes("UniVerse"));
  assert.ok(navigator.userAgent.includes("Safari/537.36"));
  assert.equal(navigator.vendor, "UniVerse");
  const brands = navigator.userAgentData.brands;
  assert.ok(brands.every((entry) => !/Chrom/.test(entry.brand)));
  assert.ok(brands.some((entry) => entry.brand === "UniVerse"));
  assert.ok(brands.some((entry) => entry.brand === "Not-A.Brand"));
  assert.equal(
    Function.prototype.toString.call(Object.getOwnPropertyDescriptor(navigator, "userAgent").get),
    "function () { [native code] }",
  );
  assert.equal(
    Function.prototype.toString.call(Object.getOwnPropertyDescriptor(navigator, "vendor").get),
    "function () { [native code] }",
  );
  const high = await navigator.userAgentData.getHighEntropyValues(["fullVersionList"]);
  assert.ok(high.brands.every((entry) => !/Chrom/.test(entry.brand)));
  assert.ok(high.fullVersionList.every((entry) => !/Chrom/.test(entry.brand)));
});

test("identity: a page that already reports UniVerse is left alone", () => {
  const { navigator } = chromePage();
  navigator.userAgentData.brands = [{ brand: "UniVerse", version: "0" }];
  const run = new Function(
    "navigator",
    "window",
    "Navigator",
    `const isArray = Array.isArray;\n${helper}${masking}`,
  );
  run(navigator, { chrome: undefined }, navigator.constructor);
  assert.equal(navigator.userAgentData.brands[0].brand, "UniVerse");
});
