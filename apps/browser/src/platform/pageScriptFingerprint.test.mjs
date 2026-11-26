import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const script = readFileSync(new URL("../../../../packages/universecore/ios/page_script.js", import.meta.url), "utf8");
const helper = (() => {
  const start = script.indexOf("  const asNative = ");
  const end = script.indexOf("  const { keys, setPrototypeOf } = Object;\n", start);
  assert.ok(start > 0 && end > start, "page_script.js has asNative");
  return script.slice(start, end);
})();
const farbling = (() => {
  const start = script.indexOf("  const fingerprintSeed");
  const end = script.indexOf("  const plain = (value, depth) => {", start);
  assert.ok(start > 0 && end > start, "page_script.js has fingerprint farbling");
  return script.slice(start, end);
})();

const fakeMath = { random: () => 0.25, imul: Math.imul };

function makePixels(w, h) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < data.length; i++) data[i] = (i * 7) % 256;
  return data;
}

class FakeContext {
  constructor(canvas) {
    this.canvas = canvas;
  }
  getImageData() {
    return { data: new Uint8ClampedArray(this.canvas.pixels), width: this.canvas.width, height: this.canvas.height };
  }
  putImageData(image) {
    this.canvas.pixels.set(image.data);
  }
  drawImage(source) {
    this.canvas.pixels.set(source.pixels);
  }
}

class FakeCanvas {
  constructor(w = 64, h = 64) {
    this.width = w;
    this.height = h;
    this.pixels = makePixels(w, h);
  }
  getContext(kind) {
    return kind === "2d" ? new FakeContext(this) : null;
  }
  toDataURL() {
    return `data:image/png;base64,${Buffer.from(this.pixels).toString("base64")}`;
  }
  toBlob(callback) {
    callback({ size: this.pixels.length });
  }
}

class FakeAudioBuffer {
  constructor(length = 1024) {
    this.samples = new Float32Array(length);
    for (let i = 0; i < length; i++) this.samples[i] = Math.sin(i / 16) * 0.5;
  }
  getChannelData() {
    return this.samples;
  }
}

class FakeAnalyser {
  getFloatFrequencyData(array) {
    for (let i = 0; i < array.length; i++) array[i] = -50;
  }
  getByteFrequencyData(array) {
    for (let i = 0; i < array.length; i++) array[i] = 100;
  }
}

function fingerprintPage() {
  const window = { HTMLCanvasElement: FakeCanvas, CanvasRenderingContext2D: FakeContext, AudioBuffer: FakeAudioBuffer, AnalyserNode: FakeAnalyser };
  const document = { createElement: () => new FakeCanvas() };
  const run = new Function(
    "window",
    "document",
    "HTMLCanvasElement",
    "CanvasRenderingContext2D",
    "AudioBuffer",
    "AnalyserNode",
    "Math",
    `const isArray = Array.isArray;\nconst apply = Reflect.apply;\n${helper}${farbling}\nreturn fingerprintUninstall;`,
  );
  const uninstall = run(window, document, FakeCanvas, FakeContext, FakeAudioBuffer, FakeAnalyser, fakeMath);
  return { window, uninstall };
}

test("fingerprint: canvas reads are perturbed, stable per document, and read as native code", () => {
  const { uninstall } = fingerprintPage();
  const canvas = new FakeCanvas();
  const pristine = new Uint8ClampedArray(canvas.pixels);
  const first = canvas.getContext("2d").getImageData(0, 0, 64, 64).data;
  const second = canvas.getContext("2d").getImageData(0, 0, 64, 64).data;
  let changed = 0;
  let maxDelta = 0;
  for (let i = 0; i < first.length; i++) {
    if (first[i] !== pristine[i]) changed++;
    maxDelta = Math.max(maxDelta, Math.abs(first[i] - pristine[i]));
    assert.equal(first[i], second[i]);
  }
  assert.ok(changed > 0 && changed < first.length / 4);
  assert.ok(maxDelta <= 1);
  const urlFirst = canvas.toDataURL();
  const urlSecond = canvas.toDataURL();
  assert.notEqual(urlFirst, new FakeCanvas().toDataURL());
  assert.equal(urlFirst, urlSecond);
  assert.equal(Function.prototype.toString.call(FakeContext.prototype.getImageData), "function () { [native code] }");
  assert.equal(Function.prototype.toString.call(FakeCanvas.prototype.toDataURL), "function () { [native code] }");
  uninstall();
  const after = canvas.getContext("2d").getImageData(0, 0, 64, 64).data;
  assert.deepEqual(Array.from(after), Array.from(pristine));
});

test("fingerprint: audio reads carry tiny stable noise", () => {
  fingerprintPage();
  const buffer = new FakeAudioBuffer();
  const pristine = Float32Array.from(buffer.samples);
  const data = buffer.getChannelData(0);
  let changed = 0;
  for (let i = 0; i < data.length; i++) {
    assert.ok(Math.abs(data[i] - pristine[i]) <= 0.0002 + 1e-6);
    if (data[i] !== pristine[i]) changed++;
  }
  assert.ok(changed > 0);
  assert.equal(buffer.getChannelData(0), data);
  const analyser = new FakeAnalyser();
  const floats = new Float32Array(16);
  analyser.getFloatFrequencyData(floats);
  assert.ok(floats.some((v) => v !== -50));
  assert.ok(floats.every((v) => Math.abs(v + 50) <= 0.5 + 1e-9));
  const bytes = new Uint8Array(16);
  analyser.getByteFrequencyData(bytes);
  assert.ok(bytes.some((v) => v !== 100));
  assert.ok(bytes.every((v) => Math.abs(v - 100) <= 1));
});
