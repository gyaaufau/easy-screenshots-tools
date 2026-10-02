import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import sharp from 'sharp';
import { prepareMockup } from '../scripts/prepare-mockups.mjs';

test('screen opening preserves the camera and removes green edge spill', () => {
  const width = 7, height = 7;
  const data = Buffer.alloc(width * height * 4);
  function pixel(x, y, rgba) { data.set(rgba, (y * width + x) * 4); }
  for (let y = 0; y < 5; y++) for (let x = 1; x < 6; x++) pixel(x, y, [24, 26, 34, 255]);
  for (let y = 1; y < 4; y++) for (let x = 2; x < 5; x++) pixel(x, y, [13, 255, 5, 255]);
  pixel(3, 1, [24, 26, 34, 255]); // Camera inside the display.
  pixel(2, 2, [19, 141, 20, 255]); // Half-covered green edge.
  pixel(3, 6, [0, 0, 0, 40]); // Baked shadow outside the device.
  const result = prepareMockup(data, width, height);
  assert.deepEqual(result.crop, { left: 1, top: 0, width: 5, height: 5 });
  const at = (buffer, x, y) => [...buffer.subarray((y * 5 + x) * 4, (y * 5 + x + 1) * 4)];
  assert.equal(at(result.overlay, 2, 2)[3], 0);
  assert.deepEqual(at(result.overlay, 2, 1), [24, 26, 34, 255]);
  assert.equal(at(result.screenMask, 2, 1)[3], 0);
  assert.equal(at(result.screenMask, 2, 2)[3], 255);
  assert.equal(at(result.silhouette, 2, 2)[3], 255);
  const edge = at(result.overlay, 1, 2);
  assert.ok(edge[3] > 100 && edge[3] < 155);
  assert.ok(Math.abs(edge[1] - 26) <= 2, 'edge must be despilled to bezel color');
});

test('all supplied assets retain opaque hardware and discard exterior shadows', async () => {
  const models = ['iPhone 14', 'iPhone 14 Plus', 'iPhone 14 Pro', 'iPhone 14 Pro Max'];
  for (const model of models) {
    const { data, info } = await sharp(await readFile(new URL(`../mockup/${model}/Dark.png`, import.meta.url)))
      .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const result = prepareMockup(data, info.width, info.height);
    assert.ok(result.crop.width < info.width && result.crop.height < info.height);
    assert.ok(result.screen.w > result.crop.width * .85);
    assert.ok(result.screen.h > result.crop.height * .85);
    let partialEdges = 0, openings = 0;
    for (let y = 0; y < result.crop.height; y++) for (let x = 0; x < result.crop.width; x++) {
      const i = (y * result.crop.width + x) * 4;
      const source = ((y + result.crop.top) * info.width + x + result.crop.left) * 4;
      const [r, g, b, a] = data.subarray(source, source + 4);
      if (a === 255 && g <= Math.max(r, b)) {
        assert.deepEqual(result.overlay.subarray(i, i + 4), data.subarray(source, source + 4), `${model}: hardware changed`);
      }
      if (result.overlay[i + 3]) assert.ok(result.overlay[i + 1] <= Math.max(result.overlay[i], result.overlay[i + 2]) + 3, `${model}: green spill`);
      if (result.silhouette[i + 3] > 0 && result.silhouette[i + 3] < 255) partialEdges++;
      if (result.screenMask[i + 3] === 255) openings++;
    }
    assert.ok(partialEdges > 100, `${model}: smooth silhouette edges missing`);
    assert.ok(openings > 300000, `${model}: display opening missing`);
  }
});

test('served WebPs match their native screen metadata and lossless prepared pixels', async () => {
  const context = { window: {} };
  vm.runInNewContext(await readFile(new URL('../public/mockup/frames.js', import.meta.url), 'utf8'), context);
  const specs = Object.values(context.window.mockupFrameSpecs);
  assert.equal(specs.length, 4);
  for (const spec of specs) {
    const model = spec.label.replace(' · Dark', '');
    const original = await sharp(await readFile(new URL(`../mockup/${model}/Dark.png`, import.meta.url)))
      .raw().toBuffer({ resolveWithObject: true });
    const prepared = prepareMockup(original.data, original.info.width, original.info.height);
    for (const [url, expected] of [[spec.src, prepared.overlay], [spec.maskSrc, prepared.screenMask]]) {
      const served = await sharp(await readFile(new URL('../public' + url, import.meta.url)))
        .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      assert.equal(served.info.width, spec.width);
      assert.equal(served.info.height, spec.height);
      assert.deepEqual(served.data, expected, `${model}: lossless pixels changed`);
    }
    assert.equal(spec.aspect, spec.height / spec.width);
    assert.deepEqual(JSON.parse(JSON.stringify(spec.screen)), prepared.screen);
  }
});


test('React metadata matches the generated compatibility frame catalog', async () => {
  const context = { window: {} };
  vm.runInNewContext(await readFile(new URL('../public/mockup/frames.js', import.meta.url), 'utf8'), context);
  const metadata = JSON.parse(await readFile(new URL('../features/screenshot-editor/frame-specs.json', import.meta.url), 'utf8'));
  assert.deepEqual(metadata, JSON.parse(JSON.stringify(context.window.mockupFrameSpecs)));
});
