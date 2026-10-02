import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import sharp from 'sharp';

// These supplied exports use #0dff05 over a #181a22 bezel. Their opaque
// chassis and antialiased edge are distinct from the low-alpha baked shadow.
export function prepareMockup(data, width, height) {
  const silhouette = Buffer.alloc(data.length);
  let left = width, top = height, right = -1, bottom = -1;
  for (let y = 0; y < height; y++) {
    let start = width, end = -1;
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] === 255) { start = Math.min(start, x); end = x; }
    }
    if (end < 0) continue;
    function bodyEdge(x) {
      const i = (y * width + x) * 4;
      return data[i + 3] >= 64;
    }
    while (start > 0 && bodyEdge(start - 1)) start--;
    while (end < width - 1 && bodyEdge(end + 1)) end++;
    // Keep the remaining faint edge pixels only when their dark RGB belongs
    // to the chassis, rather than the gray/noisy shadow surrounding it.
    function faintEdge(x, direction) {
      const i = (y * width + x) * 4;
      let backgroundAlpha = 0;
      for (let distance = 3; distance <= 7; distance++) {
        const outside = x + direction * distance;
        if (outside >= 0 && outside < width) backgroundAlpha = Math.max(backgroundAlpha, data[(y * width + outside) * 4 + 3]);
      }
      return data[i + 3] > backgroundAlpha + 8 && Math.max(data[i], data[i + 1], data[i + 2]) <= 16;
    }
    if (start > 0 && faintEdge(start - 1, -1)) start--;
    if (end < width - 1 && faintEdge(end + 1, 1)) end++;
    for (let x = start; x <= end; x++) {
      const i = (y * width + x) * 4;
      silhouette.set([255, 255, 255, data[i + 3]], i);
    }
    left = Math.min(left, start); right = Math.max(right, end);
    top = Math.min(top, y); bottom = y;
  }
  if (right < left) throw new Error('No opaque device found');
  const crop = { left, top, width: right - left + 1, height: bottom - top + 1 };
  const overlay = Buffer.alloc(crop.width * crop.height * 4);
  const screenMask = Buffer.alloc(overlay.length);
  const croppedSilhouette = Buffer.alloc(overlay.length);
  let sx = crop.width, sy = crop.height, sr = -1, sb = -1;
  for (let y = 0; y < crop.height; y++) for (let x = 0; x < crop.width; x++) {
    const source = ((y + top) * width + x + left) * 4;
    const i = (y * crop.width + x) * 4;
    const alpha = silhouette[source + 3];
    croppedSilhouette.set(silhouette.subarray(source, source + 4), i);
    if (!alpha) continue;
    const [r, g, b] = data.subarray(source, source + 3);
    const green = g > Math.max(r, b) && g > 26;
    if (!green) { overlay.set([r, g, b, alpha], i); continue; }
    const coverage = Math.min(1, (g - 26) / (255 - 26));
    const bezelCoverage = 1 - coverage;
    if (bezelCoverage > 0) {
      const despill = (channel, key) => Math.max(0, Math.min(255, Math.round((channel - coverage * key) / bezelCoverage)));
      const red = despill(r, 13), blue = despill(b, 5);
      overlay.set([red, Math.min(despill(g, 255), Math.max(red, blue)), blue, Math.round(alpha * bezelCoverage)], i);
    }
    // The overlay supplies the antialiased bezel/display boundary; a full
    // backing pixel here avoids applying that coverage twice in compositing.
    screenMask.set([255, 255, 255, 255], i);
    sx = Math.min(sx, x); sy = Math.min(sy, y); sr = Math.max(sr, x); sb = Math.max(sb, y);
  }
  if (sr < sx) throw new Error('No green display found');
  return { crop, overlay, screenMask, silhouette: croppedSilhouette,
    screen: { x: sx, y: sy, w: sr - sx + 1, h: sb - sy + 1 } };
}

async function main() {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const destination = path.join(root, 'public/mockup');
  await mkdir(destination, { recursive: true });
  const models = [
    { folder: 'iPhone 14', id: 'iphone-14-dark', physicalW: 71.5, cutout: 'Notch' },
    { folder: 'iPhone 14 Plus', id: 'iphone-14-plus-dark', physicalW: 78.1, cutout: 'Notch' },
    { folder: 'iPhone 14 Pro', id: 'iphone-14-pro-dark', physicalW: 71.5, cutout: 'Dynamic Island' },
    { folder: 'iPhone 14 Pro Max', id: 'iphone-14-pro-max-dark', physicalW: 77.6, cutout: 'Dynamic Island' }
  ];
  const specs = {};
  for (const model of models) {
    const { data, info } = await sharp(path.join(root, 'mockup', model.folder, 'Dark.png'))
      .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const prepared = prepareMockup(data, info.width, info.height);
    const raw = { width: prepared.crop.width, height: prepared.crop.height, channels: 4 };
    for (const [suffix, buffer] of [['', prepared.overlay], ['-screen', prepared.screenMask]]) {
      await sharp(buffer, { raw }).webp({ lossless: true, effort: 6 })
        .toFile(path.join(destination, model.id + suffix + '.webp'));
    }
    specs[model.id] = {
      label: model.folder + ' · Dark', description: model.cutout + ' · mockup asli · Dark',
      width: raw.width, height: raw.height, aspect: raw.height / raw.width,
      sizeScale: model.physicalW / 71.6, screen: prepared.screen,
      src: '/mockup/' + model.id + '.webp',
      maskSrc: '/mockup/' + model.id + '-screen.webp'
    };
    console.log(model.folder, `${raw.width} × ${raw.height}`);
  }
  await writeFile(path.join(root, 'features/screenshot-editor/frame-specs.json'), JSON.stringify(specs, null, 2) + '\n');
  await writeFile(path.join(destination, 'frames.js'),
    '// Generated by npm run prepare:mockups.\nwindow.mockupFrameSpecs = ' + JSON.stringify(specs, null, 2) + ';\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
