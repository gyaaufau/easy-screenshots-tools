import { stickerResize } from './stickers';
import { drawOrnament, ornamentShape, canvasHitAt } from './ornaments';
import { frameGeometry } from './frameGeometry';
import { paintText } from './textStyles';
import type { Device, Slide } from './model';
import type { FrameSpec } from './session';
import type { TextTransformKey } from './model';
import type { EditorSession } from './session';
export interface Point {
    x: number;
    y: number;
}
export interface Dimensions {
    w: number;
    h: number;
}
export interface Bounds extends Point, Dimensions {
}
export interface CanvasShape extends Dimensions {
    cx: number;
    cy: number;
    rotation: number;
}
export interface TextZone extends CanvasShape {
    type: 'headline' | 'subtitle';
    baseW: number;
    baseH: number;
}
export interface TextBlock extends Bounds {
    type: 'headline' | 'subtitle';
    draw: (context: CanvasRenderingContext2D) => void;
}
export interface PreviewGeometry {
    phones: {
        id: number;
        phone: CanvasShape;
    }[];
    images: {
        id: number;
        image: CanvasShape;
    }[];
    textZones: TextZone[];
}
export interface ResizeHandle extends Point {
    cursor: string;
}
export function installCanvas(session: EditorSession) {
    session.rr = function (this: EditorSession, c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
        const session = this;
        r = Math.min(r, w / 2, h / 2);
        c.beginPath();
        c.moveTo(x + r, y);
        c.arcTo(x + w, y, x + w, y + h, r);
        c.arcTo(x + w, y + h, x, y + h, r);
        c.arcTo(x, y + h, x, y, r);
        c.arcTo(x, y, x + w, y, r);
        c.closePath();
    };
    session.luminance = function (this: EditorSession, hex: string): number {
        const session = this;
        let c = hex.replace('#', '');
        if (c.length === 3)
            c = c.split('').map(function (x: any): any { return x + x; }).join('');
        let r = parseInt(c.slice(0, 2), 16), g = parseInt(c.slice(2, 4), 16), b = parseInt(c.slice(4, 6), 16);
        return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    };
    session.textColor = function (this: EditorSession, bg: string): string {
        const session = this;
        return session.luminance(bg) > .64 ? '#151719' : '#ffffff';
    };
    session.serifFonts = { 'Playfair Display': true, 'Lora': true, 'Merriweather': true, 'DM Serif Display': true };
    session.fontFamily = function (this: EditorSession, name: string): string {
        const session = this;
        return '"' + name.replace(/"/g, '') + '", ' + (session.serifFonts[name] ? 'serif' : 'sans-serif');
    };
    session.colorWithAlpha = function (this: EditorSession, hex: string, alpha: number): string {
        const session = this;
        let c = hex.replace('#', '');
        if (c.length === 3)
            c = c.split('').map(function (x: any): any { return x + x; }).join('');
        return 'rgba(' + parseInt(c.slice(0, 2), 16) + ',' + parseInt(c.slice(2, 4), 16) + ',' + parseInt(c.slice(4, 6), 16) + ',' + session.clamp(alpha, 0, 1) + ')';
    };
    session.mixHex = function (this: EditorSession, a: string, b: string): string {
        const session = this;
        function channel(hex: string, start: number): number { return parseInt(hex.replace('#', '').slice(start, start + 2), 16); }
        let r = Math.round((channel(a, 0) + channel(b, 0)) / 2), g = Math.round((channel(a, 2) + channel(b, 2)) / 2), bl = Math.round((channel(a, 4) + channel(b, 4)) / 2);
        return '#' + [r, g, bl].map(function (v: any): any { return v.toString(16).padStart(2, '0'); }).join('');
    };
    session.backgroundTextBase = function (this: EditorSession): string {
        const session = this;
        if (session.state.backgroundType === 'gradient')
            return session.mixHex(session.state.gradientColor1, session.state.gradientColor2);
        if (session.state.backgroundType === 'pattern')
            return session.state.patternBaseColor;
        return session.state.color;
    };
    session.drawBackground = function (this: EditorSession, c: CanvasRenderingContext2D, p: Dimensions): void {
        const session = this;
        if (session.state.backgroundType === 'gradient') {
            let angle = (session.state.gradientAngle - 90) * Math.PI / 180, dx = Math.cos(angle), dy = Math.sin(angle);
            let reach = Math.abs(dx) * p.w / 2 + Math.abs(dy) * p.h / 2;
            let gradient = c.createLinearGradient(p.w / 2 - dx * reach, p.h / 2 - dy * reach, p.w / 2 + dx * reach, p.h / 2 + dy * reach);
            gradient.addColorStop(0, session.state.gradientColor1);
            gradient.addColorStop(1, session.state.gradientColor2);
            c.fillStyle = gradient;
            c.fillRect(0, 0, p.w, p.h);
            return;
        }
        if (session.state.backgroundType !== 'pattern') {
            c.fillStyle = session.state.color;
            c.fillRect(0, 0, p.w, p.h);
            return;
        }
        c.fillStyle = session.state.patternBaseColor;
        c.fillRect(0, 0, p.w, p.h);
        let tile = document.createElement('canvas');
        let size = Math.max(24, Math.round(p.w * session.state.patternScale / 100));
        let tileW = size, tileH = size;
        if (session.state.patternType === 'upload' && session.state.patternImage) {
            tileH = Math.max(16, Math.min(Math.round(size * session.state.patternImage.height / session.state.patternImage.width), Math.round(p.h * .35)));
        }
        tile.width = tileW;
        tile.height = tileH;
        let tc = tile.getContext('2d')!;
        if (session.state.patternType === 'upload' && session.state.patternImage) {
            tc.drawImage(session.state.patternImage, 0, 0, tileW, tileH);
        }
        else {
            tc.strokeStyle = session.state.patternInkColor;
            tc.fillStyle = session.state.patternInkColor;
            tc.lineWidth = Math.max(2, size * .055);
            if (session.state.patternType === 'lines') {
                tc.beginPath();
                [-size, 0, size].forEach(function (offset: any): any { tc.moveTo(offset, tileH); tc.lineTo(offset + tileW, 0); });
                tc.stroke();
            }
            else if (session.state.patternType === 'grid') {
                tc.beginPath();
                tc.moveTo(.5, 0);
                tc.lineTo(.5, tileH);
                tc.moveTo(0, .5);
                tc.lineTo(tileW, .5);
                tc.stroke();
            }
            else {
                tc.beginPath();
                tc.arc(tileW / 2, tileH / 2, Math.max(3, size * .085), 0, Math.PI * 2);
                tc.fill();
            }
        }
        let pattern = c.createPattern(tile, 'repeat');
        if (pattern) {
            c.save();
            c.globalAlpha = session.state.patternOpacity / 100;
            c.fillStyle = pattern;
            c.fillRect(0, 0, p.w, p.h);
            c.restore();
        }
    };
    session.fitText = function (this: EditorSession, c: CanvasRenderingContext2D, text: string, maxWidth: number, start: number, min: number, weight: number): number {
        const session = this;
        let size = start;
        while (size > min) {
            c.font = weight + ' ' + size + 'px Archivo, sans-serif';
            if (c.measureText(text).width <= maxWidth)
                break;
            size -= 2;
        }
        return size;
    };
    session.wrapText = function (this: EditorSession, c: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
        const session = this;
        let words = text.trim().split(/\s+/), lines = [], line = '';
        for (let i = 0; i < words.length; i++) {
            let test = line ? line + ' ' + words[i] : words[i];
            if (c.measureText(test).width > maxWidth && line) {
                lines.push(line);
                line = words[i];
            }
            else
                line = test;
        }
        if (line)
            lines.push(line);
        if (lines.length > maxLines) {
            lines = lines.slice(0, maxLines);
            let last = lines[maxLines - 1];
            while (c.measureText(last + '…').width > maxWidth && last.length > 1)
                last = last.slice(0, -1);
            lines[maxLines - 1] = last.trim() + '…';
        }
        return lines;
    };
    session.drawImageFitted = function (this: EditorSession, c: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number, device: Device): void {
        const session = this;
        let baseScale = device.imageFit === 'contain' ? Math.min(w / img.width, h / img.height) : Math.max(w / img.width, h / img.height);
        let scale = baseScale * device.zoom / 100;
        let dw = img.width * scale, dh = img.height * scale;
        let travelX = Math.abs(w - dw) / 2, travelY = Math.abs(h - dh) / 2;
        let panX = travelX * device.screenPanX / 100, panY = travelY * device.screenPanY / 100;
        let dx = x + (w - dw) / 2 + panX, dy = y + (h - dh) / 2 + panY;
        c.fillStyle = '#090a0b';
        c.fillRect(x, y, w, h);
        c.drawImage(img, dx, dy, dw, dh);
    };
    session.drawPlaceholder = function (this: EditorSession, c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, dark: boolean): void {
        const session = this;
        c.fillStyle = dark ? '#17191c' : '#eceff1';
        c.fillRect(x, y, w, h);
        let cx = x + w / 2, cy = y + h / 2;
        c.strokeStyle = dark ? '#737a82' : '#7f878f';
        c.lineWidth = Math.max(2, w * .008);
        c.setLineDash([w * .025, w * .018]);
        session.rr(c, x + w * .15, cy - w * .18, w * .7, w * .36, w * .05);
        c.stroke();
        c.setLineDash([]);
        c.beginPath();
        c.moveTo(cx, cy - w * .07);
        c.lineTo(cx, cy + w * .06);
        c.moveTo(cx, cy - w * .07);
        c.lineTo(cx - w * .05, cy - w * .01);
        c.moveTo(cx, cy - w * .07);
        c.lineTo(cx + w * .05, cy - w * .01);
        c.stroke();
        c.fillStyle = dark ? '#b6bbc0' : '#596169';
        c.textAlign = 'center';
        c.textBaseline = 'top';
        c.font = '600 ' + Math.max(12, w * .04) + 'px IBM Plex Sans, sans-serif';
        c.fillText('Upload screenshot', cx, cy + w * .1);
    };
    session.drawPhone = function (this: EditorSession, c: CanvasRenderingContext2D, p: Bounds, kind: string, device: Device): void {
        const session = this;
        let spec = session.frameSpec(kind), assets = session.mockupAssets(kind);
        if (assets.status !== 'ready') {
            c.fillStyle = '#737a82';
            c.textAlign = 'center';
            c.textBaseline = 'middle';
            c.font = '600 ' + Math.max(12, p.w * .035) + 'px IBM Plex Sans, sans-serif';
            c.fillText(assets.status === 'error' ? 'Mockup gagal dimuat' : 'Memuat mockup…', p.x + p.w / 2, p.y + p.h / 2);
            return;
        }
        // Compose at the destination resolution so large exported screenshots
        // remain sharp even though the supplied hardware art is smaller.
        let matrix = c.getTransform(), scale = Math.hypot(matrix.a, matrix.b);
        let surface = assets.surface, W = Math.max(1, Math.ceil(p.w * scale)), H = Math.max(1, Math.ceil(p.h * scale));
        if (surface.width !== W || surface.height !== H) {
            surface.width = W;
            surface.height = H;
        }
        let sc = surface.getContext('2d')!, screen = spec.screen;
        sc.setTransform(1, 0, 0, 1, 0, 0);
        sc.clearRect(0, 0, W, H);
        sc.setTransform(W / spec.width, 0, 0, H / spec.height, 0, 0);
        if (device.image)
            session.drawImageFitted(sc, device.image, screen.x, screen.y, screen.w, screen.h, device);
        else
            session.drawPlaceholder(sc, screen.x, screen.y, screen.w, screen.h, true);
        sc.globalCompositeOperation = 'destination-in';
        sc.drawImage(assets.mask, 0, 0, spec.width, spec.height);
        sc.globalCompositeOperation = 'source-over';
        sc.drawImage(assets.image, 0, 0, spec.width, spec.height);
        c.save();
        if (device.shadowEnabled) {
            c.shadowColor = session.colorWithAlpha(device.shadowColor, device.shadowOpacity / 100);
            // Canvas shadow distances use raster pixels, independent of its transform.
            c.shadowBlur = p.w * device.shadowBlur / 100 * scale;
            c.shadowOffsetX = p.w * device.shadowOffsetX / 100 * scale;
            c.shadowOffsetY = p.w * device.shadowOffsetY / 100 * scale;
        }
        // One draw casts shadow from the complete device, including its screen.
        c.drawImage(surface, p.x, p.y, p.w, p.h);
        c.restore();
    };
    session.applyPhoneState = function (this: EditorSession, base: Bounds, p: Dimensions, device: Device): CanvasShape {
        const session = this;
        let scale = device.frameZoom / 100;
        let sourceW = device.frameWidthPct === null ? base.w / p.w * 100 : device.frameWidthPct;
        let sourceH = device.frameHeightPct === null ? base.h / p.h * 100 : device.frameHeightPct;
        let w = p.w * sourceW / 100 * scale;
        let h = p.h * sourceH / 100 * scale;
        let spec = session.frameSpec(device.kind);
        let aspect = spec.aspect || ((spec.physicalH || 0) / (spec.physicalW || 1));
        if (isFinite(aspect) && aspect > 0 && Math.abs(h / w - aspect) / aspect > .001)
            h = w * aspect;
        return {
            cx: p.w / 2 + p.w * device.frameOffsetXPct / 100,
            cy: p.h / 2 + p.h * device.frameOffsetYPct / 100,
            w: w, h: h, rotation: device.frameRotation * Math.PI / 180
        };
    };
    session.applyImageState = function (this: EditorSession, base: Bounds, p: Dimensions, device: Device): CanvasShape {
        const session = this;
        if (device.imageOffsetXPct === null) {
            device.imageOffsetXPct = (base.x + base.w / 2) / p.w * 100;
            device.imageOffsetYPct = (base.y + base.h / 2) / p.h * 100;
            device.imageWidthPct = base.w / p.w * 100;
            device.imageHeightPct = base.h / p.h * 100;
        }
        return { cx: p.w * device.imageOffsetXPct / 100, cy: p.h * (device.imageOffsetYPct || 0) / 100, w: p.w * (device.imageWidthPct || 0) / 100 * device.zoom / 100, h: p.h * (device.imageHeightPct || 0) / 100 * device.zoom / 100, rotation: device.imageRotation * Math.PI / 180 };
    };
    session.drawImageLayer = function (this: EditorSession, c: CanvasRenderingContext2D, p: CanvasShape, device: Device): void {
        const session = this;
        if (!device.image)
            return;
        c.save();
        c.translate(p.cx, p.cy);
        c.rotate(p.rotation);
        c.drawImage(device.image, -p.w / 2, -p.h / 2, p.w, p.h);
        c.restore();
    };
    session.drawPhoneTransformed = function (this: EditorSession, c: CanvasRenderingContext2D, p: CanvasShape, device: Device): void {
        const session = this;
        c.save();
        c.translate(p.cx, p.cy);
        c.rotate(p.rotation);
        session.drawPhone(c, { x: -p.w / 2, y: -p.h / 2, w: p.w, h: p.h }, device.kind, device);
        c.restore();
    };
    session.drawSelection = function (this: EditorSession, c: CanvasRenderingContext2D, p: CanvasShape, output: Dimensions): void {
        const session = this;
        let hs = output.w * .018;
        let rotateGap = output.w * .07;
        let rotateRadius = output.w * .025;
        c.save();
        c.translate(p.cx, p.cy);
        c.rotate(p.rotation);
        c.strokeStyle = '#2878ff';
        c.lineWidth = output.w * .004;
        c.setLineDash([output.w * .014, output.w * .01]);
        c.strokeRect(-p.w / 2, -p.h / 2, p.w, p.h);
        c.setLineDash([]);
        c.fillStyle = '#ffffff';
        c.strokeStyle = '#2878ff';
        c.lineWidth = output.w * .003;
        [[-p.w / 2, -p.h / 2], [p.w / 2, -p.h / 2], [p.w / 2, p.h / 2], [-p.w / 2, p.h / 2]].forEach(function (pt: any): any { c.beginPath(); c.arc(pt[0], pt[1], hs, 0, Math.PI * 2); c.fill(); c.stroke(); });
        c.beginPath();
        c.moveTo(0, -p.h / 2);
        c.lineTo(0, -p.h / 2 - rotateGap);
        c.stroke();
        c.beginPath();
        c.arc(0, -p.h / 2 - rotateGap, rotateRadius, 0, Math.PI * 2);
        c.fill();
        c.stroke();
        c.beginPath();
        c.arc(0, -p.h / 2 - rotateGap, rotateRadius * .48, -Math.PI * .8, Math.PI * .55);
        c.stroke();
        c.beginPath();
        c.moveTo(rotateRadius * .41, -p.h / 2 - rotateGap - rotateRadius * .34);
        c.lineTo(rotateRadius * .58, -p.h / 2 - rotateGap - rotateRadius * .02);
        c.lineTo(rotateRadius * .23, -p.h / 2 - rotateGap - rotateRadius * .01);
        c.stroke();
        c.restore();
    };
    session.textZoneFor = function (this: EditorSession, block: TextBlock, output: Dimensions): TextZone {
        const session = this;
        let prefix = block.type === 'headline' ? 'headline' : 'subtitle';
        let scale = session.state[prefix + 'Scale' as TextTransformKey], rotation = session.state[prefix + 'Rotation' as TextTransformKey] * Math.PI / 180;
        return {
            type: block.type,
            cx: block.x + block.w / 2 + output.w * session.state[prefix + 'OffsetX' as TextTransformKey] / 100,
            cy: block.y + block.h / 2 + output.h * session.state[prefix + 'OffsetY' as TextTransformKey] / 100,
            w: block.w * scale, h: block.h * scale, rotation: rotation, baseW: block.w, baseH: block.h
        };
    };
    session.drawTextBlock = function (this: EditorSession, c: CanvasRenderingContext2D, block: TextBlock, output: Dimensions, full: boolean, shift: Point): TextZone {
        const session = this;
        let prefix = block.type === 'headline' ? 'headline' : 'subtitle';
        let scale = session.state[prefix + 'Scale' as TextTransformKey], rotation = session.state[prefix + 'Rotation' as TextTransformKey] * Math.PI / 180;
        let zone = session.textZoneFor(block, output);
        zone.cx += shift.x;
        zone.cy += shift.y;
        c.save();
        c.translate(zone.cx, zone.cy);
        c.rotate(rotation);
        c.scale(scale, scale);
        c.translate(-(block.x + block.w / 2), -(block.y + block.h / 2));
        block.draw(c);
        c.restore();
        if (!full)
            session.previewTextZones.push(zone);
        return zone;
    };
    session.drawTextSelection = function (this: EditorSession, c: CanvasRenderingContext2D, zone: TextZone, output: Dimensions): void {
        const session = this;
        let hs = output.w * .016, rotateGap = output.w * .055, rotateRadius = output.w * .022;
        c.save();
        c.translate(zone.cx, zone.cy);
        c.rotate(zone.rotation);
        c.strokeStyle = '#2878ff';
        c.lineWidth = output.w * .0035;
        c.setLineDash([output.w * .012, output.w * .009]);
        c.strokeRect(-zone.w / 2, -zone.h / 2, zone.w, zone.h);
        c.setLineDash([]);
        c.fillStyle = '#ffffff';
        c.strokeStyle = '#2878ff';
        c.lineWidth = output.w * .003;
        [[-zone.w / 2, -zone.h / 2], [zone.w / 2, -zone.h / 2], [zone.w / 2, zone.h / 2], [-zone.w / 2, zone.h / 2]].forEach(function (pt: any): any { c.beginPath(); c.arc(pt[0], pt[1], hs, 0, Math.PI * 2); c.fill(); c.stroke(); });
        c.beginPath();
        c.moveTo(0, -zone.h / 2);
        c.lineTo(0, -zone.h / 2 - rotateGap);
        c.stroke();
        c.beginPath();
        c.arc(0, -zone.h / 2 - rotateGap, rotateRadius, 0, Math.PI * 2);
        c.fill();
        c.stroke();
        c.restore();
    };
    session.deviceBaseFromReference = function (this: EditorSession, base: Bounds, spec: FrameSpec): Bounds {
        const session = this;
        let scale = spec.sizeScale || 1;
        let w = base.w * scale;
        let h = spec.physicalH ? base.w * spec.physicalH / 71.6 : w * spec.aspect;
        return { x: base.x + base.w / 2 - w / 2, y: base.y + base.h / 2 - h / 2, w: w, h: h };
    };
    const argumentsSession = session;
    session.drawCanvas = function (this: EditorSession, target: HTMLCanvasElement, full: boolean, dimensions: Dimensions | undefined = undefined, slide: Slide = argumentsSession.state): PreviewGeometry {
        const session: EditorSession = Object.assign(Object.create(argumentsSession), { state: slide, previewPhones: [], previewImages: [], previewTextZones: [] });
        let p = session.presets[session.state.preset];
        if (!full)
            session.previewTextZones = [];
        let W = dimensions ? dimensions.w : (full ? p.w : Math.round(p.w / 2));
        let H = dimensions ? dimensions.h : (full ? p.h : Math.round(p.h / 2));
        // Avoid resetting the live canvas during a pointer gesture. Reassigning
        // width/height clears pointer capture in some webviews and used to stop
        // rotate drags after their first movement.
        if (target.width !== W || target.height !== H) {
            target.width = W;
            target.height = H;
        }
        let c = target.getContext('2d')!;
        let s = W / p.w;
        c.setTransform(s, 0, 0, s, 0, 0);
        session.drawBackground(c, p);
        session.state.ornaments.filter(item => item.layer === 'back').forEach(item => drawOrnament(c,item,p));
        let ink = session.textColor(session.backgroundTextBase());
        let margin = p.w * .095;
        let headline = session.state.headline.trim() || 'Tulis headline kamu';
        let subtitle = session.state.subtitle.trim();
        let textBlocks: TextBlock[] = [];
        let selectedDevice = session.activeDevice();
        function widest(lines: string[]): number { let max = 0; lines.forEach(function (line: any): any { max = Math.max(max, c.measureText(line).width); }); return max; }
        let headlineFamily = session.fontFamily(session.state.headlineFont), subtitleFamily = session.fontFamily(session.state.subtitleFont);
        if (session.state.layout === 'left' && p.h / p.w < 2.2) {
            let textW = p.w * .43;
            let size = session.state.headlineFontSize;
            c.font = '800 ' + size + 'px ' + headlineFamily;
            let lines = session.wrapText(c, headline, textW, 4), lineH = size * 1.03, ty = p.h * .17;
            let leftTitleW = Math.min(textW, widest(lines) + p.w * .018);
            textBlocks.push({ type: 'headline', x: margin, y: ty, w: leftTitleW, h: Math.max(lineH, lines.length * lineH), draw: (function (ls: string[], fontSize: number, y: number, family: string) { return function (dc: CanvasRenderingContext2D) { dc.fillStyle = ink; dc.textBaseline = 'top'; dc.textAlign = 'left'; dc.font = '800 ' + fontSize + 'px ' + family; ls.forEach(function (line, i: any): any { paintText(dc, line, margin, y + i * lineH, session.state.headlineStyle, fontSize); }); }; })(lines, size, ty, headlineFamily) });
            let subEnd = ty + lines.length * lineH;
            if (subtitle) {
                let subFont = session.state.subtitleFontSize;
                c.font = '500 ' + subFont + 'px ' + subtitleFamily;
                let subs = session.wrapText(c, subtitle, textW, 3), subY = subEnd + p.w * .04, subLH = subFont * 1.35;
                let leftSubW = Math.min(textW, widest(subs) + p.w * .018);
                textBlocks.push({ type: 'subtitle', x: margin, y: subY, w: leftSubW, h: Math.max(subLH, subs.length * subLH), draw: (function (ls: string[], fontSize: number, y: number, family: string) { return function (dc: CanvasRenderingContext2D) { dc.fillStyle = ink; dc.globalAlpha = .82; dc.textBaseline = 'top'; dc.textAlign = 'left'; dc.font = '500 ' + fontSize + 'px ' + family; ls.forEach(function (line, i: any): any { paintText(dc, line, margin, y + i * subLH, session.state.subtitleStyle, fontSize); }); dc.globalAlpha = 1; }; })(subs, subFont, subY, subtitleFamily) });
            }
        }
        else {
            let maxW = p.w - margin * 2;
            let titleSize = session.state.headlineFontSize;
            c.font = '800 ' + titleSize + 'px ' + headlineFamily;
            let titleLines = session.wrapText(c, headline, maxW, 3), titleLH = titleSize * 1.02;
            let titleBlockW = Math.min(maxW, widest(titleLines) + p.w * .025);
            let titleX = (p.w - titleBlockW) / 2;
            if (session.state.layout === 'bottom') {
                let bottomY = p.h * .75;
                textBlocks.push({ type: 'headline', x: titleX, y: bottomY, w: titleBlockW, h: Math.max(titleLH, titleLines.length * titleLH), draw: (function (ls: string[], fontSize: number, y: number, family: string) { return function (dc: CanvasRenderingContext2D) { dc.fillStyle = ink; dc.textBaseline = 'top'; dc.textAlign = 'center'; dc.font = '800 ' + fontSize + 'px ' + family; ls.forEach(function (line, i: any): any { paintText(dc, line, p.w / 2, y + i * titleLH, session.state.headlineStyle, fontSize); }); }; })(titleLines, titleSize, bottomY, headlineFamily) });
                if (subtitle) {
                    let bottomSubY = bottomY + titleLines.length * titleLH + p.w * .03, bottomSubFont = session.state.subtitleFontSize, bottomSubLH = bottomSubFont * 1.35;
                    c.font = '500 ' + bottomSubFont + 'px ' + subtitleFamily;
                    let bottomSubs = session.wrapText(c, subtitle, maxW, 2), bottomSubW = Math.min(maxW, widest(bottomSubs) + p.w * .02);
                    textBlocks.push({ type: 'subtitle', x: (p.w - bottomSubW) / 2, y: bottomSubY, w: bottomSubW, h: Math.max(bottomSubLH, bottomSubs.length * bottomSubLH), draw: (function (ls: string[], fontSize: number, y: number, family: string) { return function (dc: CanvasRenderingContext2D) { dc.fillStyle = ink; dc.globalAlpha = .82; dc.textBaseline = 'top'; dc.textAlign = 'center'; dc.font = '500 ' + fontSize + 'px ' + family; ls.forEach(function (line, i: any): any { paintText(dc, line, p.w / 2, y + i * bottomSubLH, session.state.subtitleStyle, fontSize); }); dc.globalAlpha = 1; }; })(bottomSubs, bottomSubFont, bottomSubY, subtitleFamily) });
                }
            }
            else {
                let topY = p.h * .065;
                textBlocks.push({ type: 'headline', x: titleX, y: topY, w: titleBlockW, h: Math.max(titleLH, titleLines.length * titleLH), draw: (function (ls: string[], fontSize: number, y: number, family: string) { return function (dc: CanvasRenderingContext2D) { dc.fillStyle = ink; dc.textBaseline = 'top'; dc.textAlign = 'center'; dc.font = '800 ' + fontSize + 'px ' + family; ls.forEach(function (line, i: any): any { paintText(dc, line, p.w / 2, y + i * titleLH, session.state.headlineStyle, fontSize); }); }; })(titleLines, titleSize, topY, headlineFamily) });
                let topSubEnd = topY + titleLines.length * titleLH;
                if (subtitle) {
                    let topSubY = topSubEnd + p.w * .025, topSubFont = session.state.subtitleFontSize, topSubLH = topSubFont * 1.35;
                    c.font = '500 ' + topSubFont + 'px ' + subtitleFamily;
                    let subLines = session.wrapText(c, subtitle, maxW, 2), topSubW = Math.min(maxW, widest(subLines) + p.w * .02);
                    textBlocks.push({ type: 'subtitle', x: (p.w - topSubW) / 2, y: topSubY, w: topSubW, h: Math.max(topSubLH, subLines.length * topSubLH), draw: (function (ls: string[], fontSize: number, y: number, family: string) { return function (dc: CanvasRenderingContext2D) { dc.fillStyle = ink; dc.globalAlpha = .82; dc.textBaseline = 'top'; dc.textAlign = 'center'; dc.font = '500 ' + fontSize + 'px ' + family; ls.forEach(function (line, i: any): any { paintText(dc, line, p.w / 2, y + i * topSubLH, session.state.subtitleStyle, fontSize); }); dc.globalAlpha = 1; }; })(subLines, topSubFont, topSubY, subtitleFamily) });
                    topSubEnd += subLines.length * topSubLH + p.w * .025;
                }
            }
        }
        let ordered = session.state.frames.filter(function (device: any): any { return device.id !== session.state.activeFrameId; });
        ordered.push(selectedDevice);
        if (!full) {
            session.previewPhones = [];
            session.previewImages = [];
        }
        let layers: {
            device: Device;
            phone: CanvasShape;
        }[] = [];
        ordered.forEach(function (device: any): any {
            layers.push({ device: device, phone: frameGeometry(session.state,device,p,session.frameSpec(device.kind)) });
        });
        textBlocks.forEach(function (block: any): any { session.drawTextBlock(c, block, p, full, { x: 0, y: 0 }); });
        layers.forEach(function (layer: any): any {
            session.drawPhoneTransformed(c, layer.phone, layer.device);
            if (!full) {
                session.previewPhones.push({ id: layer.device.id, phone: layer.phone });
                if (layer.device.id === session.state.activeFrameId) {
                    session.previewPhone = layer.phone;

                }
            }
        });
        session.state.ornaments.filter(item => item.layer === 'front').forEach(item => drawOrnament(c,item,p));
        if (!full && session.selectedOrnament != null) {
            const item = session.state.ornaments.find(item => item.id === session.selectedOrnament);
            if (item) session.drawSelection(c,ornamentShape(item,p),p);
        } else if (!full && !session.selectedText && session.activeObject === 'phone' && session.previewPhone) {
            session.drawSelection(c,session.previewPhone,p);
        }
        if (!full && session.selectedText) {
            let selectedZone = session.previewTextZones.find(function (zone: any): any { return zone.type === session.selectedText; });
            if (selectedZone)
                session.drawTextSelection(c, selectedZone, p);
            else
                session.selectedText = null;
        }
        if (!full) {
            argumentsSession.previewPhones = session.previewPhones;
            argumentsSession.previewImages = session.previewImages;
            argumentsSession.previewTextZones = session.previewTextZones;
            argumentsSession.previewPhone = session.previewPhone;
            argumentsSession.selectedText = session.selectedText;
        }
        return { phones: session.previewPhones, images: session.previewImages, textZones: session.previewTextZones };
    };
    session.clamp = function (this: EditorSession, value: number, min: number, max: number): number {
        const session = this;
        return Math.min(max, Math.max(min, value));
    };
    session.pointerPoint = function (this: EditorSession, e: PointerEvent | MouseEvent): Point {
        const session = this;
        let r = session.canvas.getBoundingClientRect(), p = session.presets[session.state.preset];
        return { x: (e.clientX - r.left) / r.width * p.w, y: (e.clientY - r.top) / r.height * p.h };
    };
    session.textZoneAt = function (this: EditorSession, point: Point): TextZone | null {
        const session = this;
        for (let i = session.previewTextZones.length - 1; i >= 0; i--) {
            let z = session.previewTextZones[i], local = session.pointInPhone(point, z);
            if (Math.abs(local.x) <= z.w / 2 && Math.abs(local.y) <= z.h / 2)
                return z;
        }
        return null;
    };
    session.pointInPhone = function (this: EditorSession, point: Point, phone: CanvasShape): Point {
        const session = this;
        let cos = Math.cos(-phone.rotation), sin = Math.sin(-phone.rotation), dx = point.x - phone.cx, dy = point.y - phone.cy;
        return { x: dx * cos - dy * sin, y: dx * sin + dy * cos };
    };
    session.phoneContains = function (this: EditorSession, point: Point, phone: CanvasShape): boolean {
        const session = this;
        let local = session.pointInPhone(point, phone);
        return Math.abs(local.x) <= phone.w / 2 && Math.abs(local.y) <= phone.h / 2;
    };
    session.phoneHitAt = function (this: EditorSession, point: Point): {
        id: number;
        phone: CanvasShape;
    } | null {
        const session = this;
        for (let i = session.previewPhones.length - 1; i >= 0; i--) {
            let item = session.previewPhones[i];
            if (session.phoneContains(point, item.phone))
                return item;
        }
        return null;
    };
    session.imageHitAt = function (this: EditorSession, point: Point): {
        id: number;
        image: CanvasShape;
    } | null {
        const session = this;
        for (let i = session.previewImages.length - 1; i >= 0; i--)
            if (session.phoneContains(point, session.previewImages[i].image))
                return session.previewImages[i];
        return null;
    };
    session.handleAt = function (this: EditorSession, point: Point, phone: CanvasShape): ResizeHandle | null {
        const session = this;
        let local = session.pointInPhone(point, phone), p = session.presets[session.state.preset], hit = p.w * .045;
        let handles = [{ x: -phone.w / 2, y: -phone.h / 2, cursor: 'nwse-resize' }, { x: phone.w / 2, y: -phone.h / 2, cursor: 'nesw-resize' }, { x: phone.w / 2, y: phone.h / 2, cursor: 'nwse-resize' }, { x: -phone.w / 2, y: phone.h / 2, cursor: 'nesw-resize' }];
        for (let i = 0; i < handles.length; i++)
            if (Math.hypot(local.x - handles[i].x, local.y - handles[i].y) <= hit)
                return handles[i];
        return null;
    };
    session.rotationHandleAt = function (this: EditorSession, point: Point, phone: CanvasShape): boolean {
        const session = this;
        let local = session.pointInPhone(point, phone), p = session.presets[session.state.preset];
        let handleY = -phone.h / 2 - p.w * .07;
        return Math.hypot(local.x, local.y - handleY) <= p.w * .05;
    };
    session.textHandleAt = function (this: EditorSession, point: Point, zone: TextZone): ResizeHandle | null {
        const session = this;
        let local = session.pointInPhone(point, zone), p = session.presets[session.state.preset], hit = p.w * .04;
        let corners = [{ x: -zone.w / 2, y: -zone.h / 2, cursor: 'nwse-resize' }, { x: zone.w / 2, y: -zone.h / 2, cursor: 'nesw-resize' }, { x: zone.w / 2, y: zone.h / 2, cursor: 'nwse-resize' }, { x: -zone.w / 2, y: zone.h / 2, cursor: 'nesw-resize' }];
        for (let i = 0; i < corners.length; i++)
            if (Math.hypot(local.x - corners[i].x, local.y - corners[i].y) <= hit)
                return corners[i];
        return null;
    };
    session.textRotationHandleAt = function (this: EditorSession, point: Point, zone: TextZone): boolean {
        const session = this;
        let local = session.pointInPhone(point, zone), p = session.presets[session.state.preset];
        return Math.hypot(local.x, local.y - (-zone.h / 2 - p.w * .055)) <= p.w * .045;
    };
    session.bind('patternDropzone', 'drop', function (e: any): any { session.readPatternFile(e.dataTransfer.files[0]); });
    session.arrangeCascade = function (this: EditorSession, announce: boolean): void {
        const session = this;
        let count = session.state.frames.length;
        let stepX = count > 1 ? Math.min(18, 36 / (count - 1)) : 0;
        let stepY = count > 1 ? Math.min(6, 12 / (count - 1)) : 0;
        session.state.frames.forEach(function (device, index: any): any {
            device.frameOffsetXPct = (index - (count - 1) / 2) * stepX;
            device.frameOffsetYPct = (index - (count - 1) / 2) * stepY;
        });
        session.activeObject = 'phone';
        session.selectedOrnament = null;
        session.selectedText = null;
        session.render();
        if (announce)
            session.showToast(count > 1 ? 'Frame disusun cascade dengan jarak yang rapi.' : 'Frame sudah berada di tengah canvas.');
    };
    session.arrangeSideBySide = function (this: EditorSession): void {
        const session = this;
        let p = session.presets[session.state.preset], count = session.state.frames.length;
        if (count === 1) {
            session.state.frames[0].frameOffsetXPct = 0;
            session.state.frames[0].frameOffsetYPct = 0;
            session.render();
            session.showToast('Frame sudah berada di tengah canvas.');
            return;
        }
        // Use the same frame geometry as the renderer, including custom dimensions.
        // Preview geometry may describe another slide or an earlier control value.
        let items = session.state.frames.map(device => {
            const phone = frameGeometry(session.state,device,p,session.frameSpec(device.kind));
            return { device, w: phone.w, h: phone.h };
        });
        let gap = p.w * .035, totalWidth = items.reduce(function (sum, item: any): any { return sum + item.w; }, 0) + gap * (count - 1);
        let maxHeight = items.reduce(function (max, item: any): any { return Math.max(max, item.h); }, 0);
        let availableWidth = p.w * .84;
        let availableHeight = p.h * (session.state.layout === 'left' ? .82 : .66);
        let scale = Math.min(1, (availableWidth - gap * (count - 1)) / Math.max(1, totalWidth - gap * (count - 1)), availableHeight / Math.max(1, maxHeight));
        scale = Math.max(.08, scale);
        let scaledTotal = gap * (count - 1);
        items.forEach(function (item: any): any { item.w *= scale; item.h *= scale; scaledTotal += item.w; });
        let cursor = (p.w - scaledTotal) / 2;
        items.forEach(function (item: any): any {
            let device = item.device, zoomScale = device.frameZoom / 100;
            device.frameWidthPct = item.w / p.w * 100 / zoomScale;
            device.frameHeightPct = item.h / p.h * 100 / zoomScale;
            device.frameOffsetXPct = (cursor + item.w / 2) / p.w * 100 - 50;
            device.frameOffsetYPct = 0;
            cursor += item.w + gap;
        });
        session.activeObject = 'phone';
        session.selectedOrnament = null;
        session.selectedText = null;
        session.render();
        session.showToast('Frame disusun berdampingan tanpa overlap.');
    };
    session.handlePointerMove = function (this: EditorSession, e: PointerEvent): void {
        const session = this;
        if (!session.pointerAction && e.target !== session.canvas)
            return;
        let point = session.pointerPoint(e);
        if (!session.pointerAction) {
            const p = session.presets[session.state.preset];
            const item = session.state.ornaments.find(item => item.id === session.selectedOrnament);
            const zone = session.selectedText ? session.previewTextZones.find(z => z.type === session.selectedText) : null;
            const image = session.previewImages.find(item => item.id === session.state.activeFrameId);
            const shape = item ? ornamentShape(item,p) : zone || ((session.activeObject === 'screenshot' && image) ? image.image : session.activeObject === 'phone' ? session.previewPhone : null);
            const rotate = shape && (zone ? session.textRotationHandleAt(point,zone) : session.rotationHandleAt(point,shape));
            const handle = shape && session.handleAt(point,shape);
            session.canvas.style.cursor = rotate ? 'crosshair' : handle ? handle.cursor : canvasHitAt(session,point) ? 'grab' : 'default';
            return;
        }
        let p = session.presets[session.state.preset];
        if (session.pointerAction.target === 'ornament') {
            const action = session.pointerAction, item = session.state.ornaments.find(item => item.id === action.id);
            if (!item) return;
            if (action.type === 'move') {
                item.x = action.offsetX + (point.x-action.start.x)/p.w*100;
                item.y = action.offsetY + (point.y-action.start.y)/p.h*100;
            } else if (action.type === 'rotate') {
                const angle = Math.atan2(point.y-action.shape.cy,point.x-action.shape.cx);
                item.rotation = ((action.rotationDeg+(angle-action.startAngle)*180/Math.PI+540)%360)-180;
            } else {
                const local = session.pointInPhone(point,action.shape);
                const width=Math.abs(local.x)*2/p.w*100,height=Math.abs(local.y)*2/p.h*100;
                if(item.kind==='sticker')Object.assign(item,stickerResize(width,height,action.shape.w/p.w*100,action.shape.h/p.h*100));
                else {item.width=session.clamp(width,.1,200);item.height=session.clamp(height,.1,200);}
            }
        } else if (session.pointerAction.target === 'text') {
            let prefix = session.pointerAction.prefix;
            if (session.pointerAction.type === 'move') {
                session.state[prefix + 'OffsetX' as TextTransformKey] = session.pointerAction.offsetX + (point.x - session.pointerAction.start.x) / p.w * 100;
                session.state[prefix + 'OffsetY' as TextTransformKey] = session.pointerAction.offsetY + (point.y - session.pointerAction.start.y) / p.h * 100;
            }
            else if (session.pointerAction.type === 'rotate') {
                let textAngle = Math.atan2(point.y - session.pointerAction.zone.cy, point.x - session.pointerAction.zone.cx);
                session.state[prefix + 'Rotation' as TextTransformKey] = ((session.pointerAction.rotationDeg + (textAngle - session.pointerAction.startAngle) * 180 / Math.PI + 540) % 360) - 180;
            }
            else
                session.state[prefix + 'Scale' as TextTransformKey] = session.clamp(session.pointerAction.startScale * Math.hypot(point.x - session.pointerAction.zone.cx, point.y - session.pointerAction.zone.cy) / session.pointerAction.startDistance, .35, 3);
        }
        else {
            let device = session.activeDevice(), isImage = session.pointerAction.target === 'screenshot';
            if (session.pointerAction.type === 'move') {
                let nx = session.pointerAction.offsetX + (point.x - session.pointerAction.start.x) / p.w * 100, ny = session.pointerAction.offsetY + (point.y - session.pointerAction.start.y) / p.h * 100;
                if (isImage) {
                    device.imageOffsetXPct = nx;
                    device.imageOffsetYPct = ny;
                }
                else {
                    device.frameOffsetXPct = nx;
                    device.frameOffsetYPct = ny;
                }
            }
            else if (session.pointerAction.type === 'rotate') {
                let angle = Math.atan2(point.y - session.pointerAction.shape.cy, point.x - session.pointerAction.shape.cx);
                let rotation = ((session.pointerAction.rotationDeg + (angle - session.pointerAction.startAngle) * 180 / Math.PI + 540) % 360) - 180;
                if (isImage)
                    device.imageRotation = rotation;
                else {
                    device.frameRotation = rotation;
                }
            }
            else {
                let localResize = session.pointInPhone(point, session.pointerAction.shape);
                let newW = session.clamp(Math.abs(localResize.x) * 2, p.w * .06, p.w * 1.6), newH = session.clamp(Math.abs(localResize.y) * 2, p.h * .06, p.h * 1.8);
                if (isImage) {
                    device.imageWidthPct = newW / p.w * 100 / (device.zoom / 100);
                    device.imageHeightPct = newH / p.h * 100 / (device.zoom / 100);
                }
                else {
                    let spec = session.frameSpec(device.kind), aspect = spec.aspect || ((spec.physicalH || 0) / (spec.physicalW || 1));
                    newH = Math.min(p.h * 1.8, Math.max(p.h * .06, newW * aspect));
                    newW = newH / aspect;
                    device.frameWidthPct = newW / p.w * 100 / (device.frameZoom / 100);
                    device.frameHeightPct = newH / p.h * 100 / (device.frameZoom / 100);
                }
            }
        }
        session.render();
        e.preventDefault();
    };
    if (typeof window !== 'undefined') session.listen(window, 'pointermove', session.handlePointerMove, { passive: false });
    session.endPointer = function (this: EditorSession, e: PointerEvent): void {
        const session = this;
        if (!session.pointerAction)
            return;
        session.pointerAction = null;
        session.canvas.classList.remove('dragging');
        if (session.canvas.hasPointerCapture(e.pointerId))
            session.canvas.releasePointerCapture(e.pointerId);
        session.commitHistoryTransaction();
    };
}
