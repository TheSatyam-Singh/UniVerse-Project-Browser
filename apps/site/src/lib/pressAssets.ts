import { readFileSync } from "node:fs";
import sharp from "sharp";
import { COLOURS, FACTS, LONG, SHORT, SHOTS, SITE, ZIP_NAME, colour } from "../data/press";
import { zip } from "./zip";

const repoRoot = `${process.cwd()}/../..`;
const siteRoot = process.cwd();

const glyphSubpaths = (() => {
  const source = readFileSync(`${repoRoot}/engine/patches/build/universe-icons/chrome/app/vector_icons/browser_logo.icon`, "utf8");
  const letters: Record<string, string> = { MOVE_TO: "M", LINE_TO: "L", CUBIC_TO: "C", CLOSE: "Z" };
  const paths: string[] = [];
  for (const line of (source as string).split("\n")) {
    const [command, ...numbers] = line.split(",").map((s) => s.trim()).filter(Boolean);
    const letter = command && letters[command];
    if (!letter) continue;
    if (letter === "M") paths.push("");
    paths[paths.length - 1] += letter + numbers.join(" ");
  }
  return paths;
})();

const GLYPH_BOX = "0.9 2.9 14.2 10.2";
const markSvg = (fills: string[]) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${GLYPH_BOX}" width="1420" height="1020">${glyphSubpaths
    .map((d, i) => `<path fill="${fills[i] ?? fills[0]}" d="${d}"/>`)
    .join("")}</svg>\n`;

export const MARK_SVGS: Record<string, string> = {
  "mark-colour": markSvg([colour("Forest"), colour("Sage"), colour("Sun")]),
  "mark-black": markSvg([colour("Ink")]),
  "mark-white": markSvg(["#FFFFFF"]),
};

const svgToPng = (svg: string) => sharp(Buffer.from(svg), { density: 144 }).resize({ width: 2048 }).png({ compressionLevel: 9 }).toBuffer();

const builders: Record<string, () => Promise<Buffer> | Buffer> = {
  "universe-app-icon.png": () =>
    readFileSync(`${repoRoot}/apps/browser/macos/UniVerse-macOS/Assets.xcassets/AppIcon.appiconset/icon_512x512_2x.png`),
  "universe-mark-painted.png": () =>
    sharp(`${repoRoot}/docs/brand/universe/source/mark.png`).trim({ threshold: 16 }).png({ compressionLevel: 9 }).toBuffer(),
  ...Object.fromEntries(
    Object.entries(MARK_SVGS).flatMap(([id, svg]) => [
      [`universe-${id}.svg`, () => Buffer.from(svg)],
      [`universe-${id}.png`, () => svgToPng(svg)],
    ]),
  ),
  ...Object.fromEntries(
    SHOTS.map(({ id }) => [
      `universe-screenshot-${id}.jpg`,
      () => sharp(`${siteRoot}/src/assets/shots/${id}.webp`).jpeg({ quality: 92, mozjpeg: true }).toBuffer(),
    ]),
  ),
};

export const PRESS_FILES = Object.keys(builders);

const built = new Map<string, Promise<Buffer>>();
export const pressFile = (name: string) => {
  if (!built.has(name)) built.set(name, Promise.resolve(builders[name]!()));
  return built.get(name)!;
};

const readme = () =>
  [
    "UniVerse Project Browser press kit",
    "",
    SHORT,
    "",
    LONG,
    "",
    ...FACTS.map((f) => `${f.term}: ${f.href ?? f.value}`),
    "",
    "Colours",
    ...COLOURS.map((c) => `${c.name} ${c.hex}: ${c.use}`),
    "",
    "Use the logos as they are: no redrawing, recolouring, stretching or effects.",
    "UniVerse Project Browser isn’t affiliated with Google or The Browser Company. Arc, Dia and Chrome are their trademarks.",
    `More at https://${SITE}`,
    "",
  ].join("\n");

const zipEntryPath = (name: string) =>
  name.startsWith("universe-screenshot-") ? `screenshots/${name}` : `logo/${name}`;

let kit: Promise<Buffer> | undefined;
export const pressZip = () =>
  (kit ??= Promise.all(PRESS_FILES.map(async (name) => ({ path: zipEntryPath(name), data: await pressFile(name) }))).then(
    (files) => zip(ZIP_NAME.replace(/\.zip$/, ""), [{ path: "README.txt", data: Buffer.from(readme(), "utf8") }, ...files]),
  ));
