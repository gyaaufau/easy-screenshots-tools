import type { Device, Slide } from './model';
import type { FrameSpec } from './session';
import type { CanvasShape, Dimensions } from './canvas';

/** Shared geometry for drawing, arrangement, and explicit JSON transforms. */
export function frameGeometry(slide: Slide, device: Device, p: Dimensions, spec: FrameSpec): CanvasShape {
    const baseRatio = slide.layout === 'left' && p.h / p.w < 2.2 ? .44 : slide.layout === 'bottom' && p.h / p.w >= 2.2 ? .70 : .62;
    const baseWidth = p.w * baseRatio;
    const scale = device.frameZoom / 100;
    const w = (device.frameWidthPct === null ? baseWidth * (spec.sizeScale || 1) : p.w * device.frameWidthPct / 100) * scale;
    let h = (device.frameHeightPct === null ? baseWidth * (spec.physicalH ? spec.physicalH / 71.6 : spec.aspect * (spec.sizeScale || 1)) : p.h * device.frameHeightPct / 100) * scale;
    const aspect = spec.aspect || ((spec.physicalH || 0) / (spec.physicalW || 1));
    if (Number.isFinite(aspect) && aspect > 0 && Math.abs(h / w - aspect) / aspect > .001) h = w * aspect;
    return {cx:p.w/2+p.w*device.frameOffsetXPct/100,cy:p.h/2+p.h*device.frameOffsetYPct/100,w,h,rotation:device.frameRotation*Math.PI/180};
}
