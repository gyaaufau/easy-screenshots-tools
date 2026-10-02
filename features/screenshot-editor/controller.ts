import { canvasHitAt, ornamentShape } from './ornaments';
import type { TextTransformKey } from './model';
import type { EditorSession } from './session';
export function installController(session: EditorSession, frameSpecs: Record<string, import("./session").FrameSpec>) {
    session.$ = function (this: any, id: any): any { return document.getElementById(id); };
    session.raf = 0;
    session.previewPhone = null;
    session.previewPhones = [];
    session.previewImages = [];
    session.previewTextZones = [];
    session.activeObject = 'phone';
    session.selectedOrnament = null;
    session.selectedText = null;
    session.pointerAction = null;
    session.canvasZoomMode = 'screen';
    session.canvasZoomPercent = 100;
    session.activeDevice = function (this: EditorSession): any {
        const session = this;
        for (let i: any = 0; i < session.state.frames.length; i++)
            if (session.state.frames[i].id === session.state.activeFrameId)
                return session.state.frames[i];
        return session.state.frames[0];
    };
    session.frameSpecs = frameSpecs;
    session.deviceLabel = function (device: any, index: any): any {
        return 'Frame ' + (index + 1) + ' · ' + session.frameSpec(device.kind).label + (device.fileName ? ' · ' + device.fileName : '');
    };
    session.activeSlideIndex = function (): any { return session.slides.findIndex(function (this: any, slide: any): any { return slide.id === session.state.id; }); };
    session.renderAllThumbnails = function (): any { session.slides.forEach(session.renderSlideThumbnail); };
    session.switchSlide = function (id: any): any {
        let next: any = session.slides.find(function (this: any, slide: any): any { return slide.id === id; });
        if (!next || next === session.state)
            return;
        session.commitInputHistory();
        session.commitHistoryTransaction();
        session.closeInlineEditor();
        session.selectedOrnament = null;
        session.selectedText = null;
        session.activeObject = 'phone';
        session.state = next;
        session.render();
        session.notify();
        let activeCard: any = document.querySelector('.slide-card.active');
        if (activeCard)
            activeCard.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    };
    session.fitPreviewCanvases = function (): any {
        let wrap: any = session.$('canvasWrap'), strip: any = session.$('canvasStrip');
        if (!wrap || !strip)
            return;
        let style: any = getComputedStyle(wrap);
        let availableW: any = wrap.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
        let availableH: any = wrap.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
        if (availableW <= 0 || availableH <= 0)
            return;
        let cards: any = Array.prototype.slice.call(strip.querySelectorAll('.canvas-slide'));
        let total: any = 0;
        cards.forEach(function (this: any, card: any): any {
            let slide: any = session.slides.find(function (this: any, item: any): any { return item.id === Number(card.dataset.canvasSlideId); }) || session.state;
            let p: any = session.presets[slide.preset], ratio: any = p.w / p.h;
            let displayW: any;
            if (session.canvasZoomMode === 'screen')
                displayW = Math.max(1, Math.min(availableW - 12, (availableH - 12) * ratio));
            else
                displayW = p.w * session.canvasZoomPercent / 100;
            let displayH: any = displayW / ratio;
            let canvasEl: any = card.querySelector('canvas');
            canvasEl.style.width = Math.max(1, Math.floor(displayW)) + 'px';
            canvasEl.style.height = Math.max(1, Math.floor(displayH)) + 'px';
            card.style.width = Math.ceil(displayW + 12) + 'px';
            card.style.height = Math.ceil(displayH + 12) + 'px';
            total += displayW + 12;
        });
        let gap: any = parseFloat(getComputedStyle(strip).gap) || 0;
        total += Math.max(0, cards.length - 1) * gap;
        strip.classList.toggle('overflowing', total > availableW + 1);
    };
    session.bind('slideStrip', 'click', function (this: any, e: any): any {
        let card: any = e.target.closest('[data-slide-id]');
        if (card)
            session.switchSlide(Number(card.dataset.slideId));
    });
    session.bind('canvasStrip', 'click', function (this: any, e: any): any {
        let card: any = e.target.closest('[data-canvas-slide-id]');
        if (card && Number(card.dataset.canvasSlideId) !== session.state.id)
            session.switchSlide(Number(card.dataset.canvasSlideId));
    });
    session.bind('canvasStrip', 'keydown', function (this: any, e: any): any {
        if (e.key !== 'Enter' && e.key !== ' ')
            return;
        let card: any = e.target.closest('[data-canvas-slide-id]');
        if (!card)
            return;
        e.preventDefault();
        session.switchSlide(Number(card.dataset.canvasSlideId));
    });
    session.bind('addSlide', 'click', function (this: any): any {
        let currentPreset: any = session.state.preset, slide: any = session.createBlankSlide();
        slide.preset = currentPreset;
        session.slides.push(slide);
        session.state = slide;
        session.closeInlineEditor();
        session.selectedOrnament = null;
        session.selectedText = null;
        session.activeObject = 'phone';
        session.render();
        session.showToast('Screenshot baru ditambahkan.');
    });
    session.bind('duplicateSlide', 'click', function (this: any): any {
        let index: any = session.activeSlideIndex(), slide: any = session.cloneSlide(session.state);
        session.slides.splice(index + 1, 0, slide);
        session.state = slide;
        session.closeInlineEditor();
        session.selectedOrnament = null;
        session.selectedText = null;
        session.activeObject = 'phone';
        session.render();
        session.showToast('Screenshot diduplikat.');
    });
    session.bind('deleteSlide', 'click', function (this: any): any {
        if (session.slides.length === 1)
            return;
        let index: any = session.activeSlideIndex();
        session.slides.splice(index, 1);
        session.state = session.slides[Math.min(index, session.slides.length - 1)];
        session.closeInlineEditor();
        session.selectedOrnament = null;
        session.selectedText = null;
        session.activeObject = 'phone';
        session.render();
        session.showToast('Screenshot dihapus.');
    });
    session.moveActiveSlide = function (direction: any): any {
        let index: any = session.activeSlideIndex(), next: any = index + direction;
        if (next < 0 || next >= session.slides.length)
            return;
        let item: any = session.slides.splice(index, 1)[0];
        session.slides.splice(next, 0, item);
        session.render();
        session.showToast('Urutan screenshot diperbarui.');
    };
    session.bind('moveSlideLeft', 'click', function (this: any): any { session.moveActiveSlide(-1); });
    session.bind('moveSlideRight', 'click', function (this: any): any { session.moveActiveSlide(1); });
    session.bind('dropzone', 'click', function (this: any): any { session.$('fileInput').value = ''; session.$('fileInput').click(); });
    session.bind('fileInput', 'change', function (this: any, e: any): any { session.readFile(e.target.files[0]); });
    session.bind('screenshotFrame', 'change', function (this: any): any { session.state.activeFrameId = Number(this.value); session.activeObject = 'phone'; session.selectedOrnament = null; session.selectedText = null; session.render(); });
    session.bind('imageFitButtons', 'click', function (this: any, e: any): any {
        let button: any = e.target.closest('[data-image-fit]');
        if (!button)
            return;
        session.activeDevice().imageFit = button.dataset.imageFit;
        session.render();
    });
    session.bind('screenPanX', 'input', function (this: any): any { session.activeDevice().screenPanX = Number(this.value); session.render(); });
    session.bind('screenPanY', 'input', function (this: any): any { session.activeDevice().screenPanY = Number(this.value); session.render(); });
    session.bind('clearScreenshot', 'click', function (this: any): any { let device: any = session.activeDevice(); device.image = null; device.fileName = ''; device.screenPanX = 0; device.screenPanY = 0; session.render(); session.showToast('Screenshot frame ini dihapus.'); });
    ['dragenter', 'dragover'].forEach(function (this: any, type: any): any { session.bind('dropzone', type, function (this: any, e: any): any { e.preventDefault(); }); });
    ['dragleave', 'drop'].forEach(function (this: any, type: any): any { session.bind('dropzone', type, function (this: any, e: any): any { e.preventDefault(); }); });
    session.bind('dropzone', 'drop', function (this: any, e: any): any { session.readFile(e.dataTransfer.files[0]); });
    ['dragenter', 'dragover'].forEach(function (this: any, type: any): any {
        session.bind('preview', type, function (this: any, e: any): any {
            if (!e.dataTransfer || !Array.prototype.some.call(e.dataTransfer.types, function (this: any, t: any): any { return t === 'Files'; }))
                return;
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
        });
    });
    ['dragleave', 'drop'].forEach(function (this: any, type: any): any {
        session.bind('preview', type, function (this: any, e: any): any {
            if (type === 'drop')
                e.preventDefault();
        });
    });
    session.bind('preview', 'drop', function (this: any, e: any): any {
        let file: any = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
        if (!file)
            return;
        let dropPoint: any = session.pointerPoint(e), hit: any = session.phoneHitAt(dropPoint) || session.imageHitAt(dropPoint);
        if (hit && hit.id !== session.state.activeFrameId) {
            session.state.activeFrameId = hit.id;
        }
        session.activeObject = 'phone';
        session.readFile(file);
    });
    session.bind('headline', 'input', function (this: any): any { session.state.headline = this.value; session.render(); });
    session.bind('subtitle', 'input', function (this: any): any { session.state.subtitle = this.value; session.render(); });
    session.bind('headlineFont', 'change', function (this: any): any { session.state.headlineFont = this.value; session.render(); session.ensureFont(session.state.headlineFont, 800).then(session.render); });
    session.bind('subtitleFont', 'change', function (this: any): any { session.state.subtitleFont = this.value; session.render(); session.ensureFont(session.state.subtitleFont, 500).then(session.render); });
    session.bind('headlineFontSize', 'input', function (this: any): any {
        if (this.value === '')
            return;
        session.state.headlineFontSize = session.clamp(Number(this.value), 36, 220);
        session.render();
    });
    session.bind('subtitleFontSize', 'input', function (this: any): any {
        if (this.value === '')
            return;
        session.state.subtitleFontSize = session.clamp(Number(this.value), 16, 100);
        session.render();
    });
    session.bind('headlineRotate', 'input', function (this: any): any { session.state.headlineRotation = Number(this.value); session.selectedOrnament = null; session.selectedText = 'headline'; session.activeObject = 'text'; session.render(); });
    session.bind('subtitleRotate', 'input', function (this: any): any { session.state.subtitleRotation = Number(this.value); session.selectedOrnament = null; session.selectedText = 'subtitle'; session.activeObject = 'text'; session.render(); });
    session.bind('zoom', 'input', function (this: any): any { session.activeDevice().zoom = Number(this.value); session.activeObject = 'phone'; session.selectedOrnament = null; session.selectedText = null; session.render(); });
    session.bind('preset', 'change', function (this: any): any {
        let chosen: any = this.value;
        session.slides.forEach(function (this: any, slide: any): any { slide.preset = chosen; });
        session.render();
        session.showToast('Ukuran output diterapkan ke semua screenshot.');
    });
    session.bind('frame', 'change', function (this: any): any {
        let device: any = session.activeDevice();
        device.kind = this.value;
        device.frameWidthPct = null;
        device.frameHeightPct = null;
        session.activeObject = 'phone';
        session.selectedOrnament = null;
        session.selectedText = null;
        session.render();
    });
    session.bind('frameZoom', 'input', function (this: any): any { session.activeDevice().frameZoom = Number(this.value); session.activeObject = 'phone'; session.selectedOrnament = null; session.selectedText = null; session.render(); });
    session.bind('frameRotate', 'input', function (this: any): any { session.activeDevice().frameRotation = Number(this.value); session.activeObject = 'phone'; session.selectedOrnament = null; session.selectedText = null; session.render(); });
    session.bind('frameWidth', 'input', function (this: any): any {
        let v: any = Number(this.value), device: any = session.activeDevice();
        if (!isFinite(v))
            return;
        let p: any = session.presets[session.state.preset], spec: any = session.frameSpec(device.kind), aspect: any = spec.aspect || (spec.physicalH / spec.physicalW), scale: any = device.frameZoom / 100;
        session.activeObject = 'phone';
        session.selectedOrnament = null;
        session.selectedText = null;
        device.frameWidthPct = session.clamp(v, 12, 140) / scale;
        device.frameHeightPct = device.frameWidthPct * (p.w / p.h) * aspect;
        session.render();
    });
    session.bind('frameHeight', 'input', function (this: any): any {
        let v: any = Number(this.value), device: any = session.activeDevice();
        if (!isFinite(v))
            return;
        let p: any = session.presets[session.state.preset], spec: any = session.frameSpec(device.kind), aspect: any = spec.aspect || (spec.physicalH / spec.physicalW), scale: any = device.frameZoom / 100;
        session.activeObject = 'phone';
        session.selectedOrnament = null;
        session.selectedText = null;
        device.frameHeightPct = session.clamp(v, 12, 180) / scale;
        device.frameWidthPct = device.frameHeightPct * (p.h / p.w) / aspect;
        session.render();
    });
    session.bind('shadowToggle', 'click', function (this: any, e: any): any {
        let button: any = e.target.closest('[data-shadow]');
        if (!button)
            return;
        session.activeDevice().shadowEnabled = button.dataset.shadow === 'on';
        session.render();
    });
    session.bind('shadowColor', 'input', function (this: any): any { session.activeDevice().shadowColor = this.value; session.render(); });
    session.bind('shadowOpacity', 'input', function (this: any): any { session.activeDevice().shadowOpacity = Number(this.value); session.render(); });
    session.bind('shadowBlur', 'input', function (this: any): any { session.activeDevice().shadowBlur = Number(this.value); session.render(); });
    session.bind('shadowOffsetX', 'input', function (this: any): any {
        if (this.value === '')
            return;
        session.activeDevice().shadowOffsetX = session.clamp(Number(this.value), -50, 50);
        session.render();
    });
    session.bind('shadowOffsetY', 'input', function (this: any): any {
        if (this.value === '')
            return;
        session.activeDevice().shadowOffsetY = session.clamp(Number(this.value), -50, 50);
        session.render();
    });
    session.bind('layoutButtons', 'click', function (this: any, e: any): any {
        if (!e.target.dataset.layout)
            return;
        session.state.layout = e.target.dataset.layout;
        session.render();
    });
    session.bind('swatches', 'click', function (this: any, e: any): any {
        let b: any = e.target.closest('.swatch');
        if (!b)
            return;
        session.state.color = b.dataset.color;
        session.render();
    });
    session.bind('customColor', 'input', function (this: any): any { session.state.color = this.value; session.render(); });
    session.bind('backgroundTypeButtons', 'click', function (this: any, e: any): any {
        let button: any = e.target.closest('[data-background]');
        if (!button)
            return;
        session.state.backgroundType = button.dataset.background;
        session.render();
    });
    session.bind('gradientColor1', 'input', function (this: any): any { session.state.gradientColor1 = this.value; session.render(); });
    session.bind('gradientColor2', 'input', function (this: any): any { session.state.gradientColor2 = this.value; session.render(); });
    session.bind('gradientAngle', 'input', function (this: any): any { session.state.gradientAngle = Number(this.value); session.render(); });
    session.bind('patternButtons', 'click', function (this: any, e: any): any {
        let button: any = e.target.closest('[data-pattern]');
        if (!button)
            return;
        session.state.patternType = button.dataset.pattern;
        session.render();
    });
    session.bind('patternBaseColor', 'input', function (this: any): any { session.state.patternBaseColor = this.value; session.render(); });
    session.bind('patternInkColor', 'input', function (this: any): any { session.state.patternInkColor = this.value; session.render(); });
    session.bind('patternScale', 'input', function (this: any): any { session.state.patternScale = Number(this.value); session.render(); });
    session.bind('patternOpacity', 'input', function (this: any): any { session.state.patternOpacity = Number(this.value); session.render(); });
    session.bind('patternDropzone', 'click', function (this: any): any { session.$('patternFileInput').value = ''; session.$('patternFileInput').click(); });
    session.bind('patternFileInput', 'change', function (this: any, e: any): any { session.readPatternFile(e.target.files[0]); });
    ['dragenter', 'dragover'].forEach(function (this: any, type: any): any { session.bind('patternDropzone', type, function (this: any, e: any): any { e.preventDefault(); this.classList.add('drag'); }); });
    ['dragleave', 'drop'].forEach(function (this: any, type: any): any { session.bind('patternDropzone', type, function (this: any, e: any): any { e.preventDefault(); this.classList.remove('drag'); }); });
    session.bind('arrangeCascade', 'click', function (this: any): any { session.arrangeCascade(true); });
    session.bind('arrangeSideBySide', 'click', () => session.arrangeSideBySide());
    session.bind('addFrame', 'click', function (this: any): any {
        let device: any = session.createDevice(session.activeDevice());
        session.state.frames.push(device);
        session.state.activeFrameId = device.id;
        session.activeObject = 'phone';
        session.selectedOrnament = null;
        session.selectedText = null;
        session.arrangeCascade(false);
        session.showToast('Frame baru ditambahkan dalam susunan cascade.');
    });
    session.bind('frameList', 'click', function (this: any, e: any): any {
        let remove: any = e.target.closest('[data-remove-frame-id]');
        if (remove) {
            if (session.state.frames.length === 1)
                return;
            let removeId: any = Number(remove.dataset.removeFrameId), index: any = session.state.frames.findIndex(function (this: any, device: any): any { return device.id === removeId; });
            session.state.frames.splice(index, 1);
            if (session.state.activeFrameId === removeId)
                session.state.activeFrameId = session.state.frames[Math.max(0, index - 1)].id;
            session.render();
            session.showToast('Frame dihapus.');
            return;
        }
        let select: any = e.target.closest('[data-frame-id]');
        if (select) {
            session.state.activeFrameId = Number(select.dataset.frameId);
            session.activeObject = 'phone';
            session.selectedOrnament = null;
        session.selectedText = null;
            session.render();
        }
    });
    session.bind('preview', 'dblclick', function (this: any, e: any): any {
        let hit = canvasHitAt(session,session.pointerPoint(e));
        let zone = hit?.type === 'text' ? hit.item : null;
        if (zone) {
            session.openInlineEditor(zone);
            e.preventDefault();
        }
    });
    session.bind('preview', 'pointerdown', function (this: any, e: any): any {
        const point = session.pointerPoint(e), output = session.presets[session.state.preset];
        const hit = canvasHitAt(session,point);
        const ornament = session.state.ornaments.find(item => item.id === session.selectedOrnament);
        const ornamentGeometry = ornament ? ornamentShape(ornament,output) : null;
        const ornamentRotate = ornamentGeometry && session.rotationHandleAt(point,ornamentGeometry);
        const ornamentHandle = ornamentGeometry && session.handleAt(point,ornamentGeometry);
        const selectedZone = session.selectedText ? session.previewTextZones.find(z => z.type === session.selectedText) : null;
        const textRotate = selectedZone && session.textRotationHandleAt(point,selectedZone);
        const textHandle = selectedZone && session.textHandleAt(point,selectedZone);
        if (ornamentRotate || ornamentHandle || hit?.type === 'ornament') {
            const item = ornamentRotate || ornamentHandle ? ornament! : hit!.item as import('./model').Ornament;
            const shape = ornamentShape(item,output);
            session.selectedOrnament = item.id; session.selectedText = null; session.activeObject = 'ornament';
            session.pointerAction = {target:'ornament', id:item.id, type:ornamentRotate?'rotate':ornamentHandle?'resize':'move',
                start:point, shape, offsetX:item.x, offsetY:item.y, rotationDeg:item.rotation,
                startAngle:Math.atan2(point.y-shape.cy,point.x-shape.cx)};
        } else if (textRotate || textHandle || hit?.type === 'text') {
            const zone = textRotate || textHandle ? selectedZone! : hit!.item as import('./canvas').TextZone;
            const prefix = zone.type;
            session.selectedOrnament = null; session.selectedText = prefix; session.activeObject = 'text';
            session.pointerAction = {target:'text', type:textRotate?'rotate':textHandle?'resize':'move', start:point, zone,
                offsetX:session.state[`${prefix}OffsetX`], offsetY:session.state[`${prefix}OffsetY`],
                startScale:session.state[`${prefix}Scale`], startDistance:Math.max(1,Math.hypot(point.x-zone.cx,point.y-zone.cy)),
                startAngle:Math.atan2(point.y-zone.cy,point.x-zone.cx), rotationDeg:session.state[`${prefix}Rotation`], prefix};
        } else {
            const currentImage = session.previewImages.find(item => item.id === session.state.activeFrameId);
            const currentShape = session.activeObject === 'screenshot' && currentImage ? currentImage.image : session.previewPhone;
            const frameSelected = session.activeObject === 'phone' || session.activeObject === 'screenshot';
            const rotateHandle = frameSelected && currentShape && session.rotationHandleAt(point,currentShape);
            const handle = frameSelected && currentShape && session.handleAt(point,currentShape);
            let chosen: {id:number;shape:import('./canvas').CanvasShape} | null = null;
            let target = session.activeObject;
            if (rotateHandle || handle) chosen={id:session.state.activeFrameId,shape:currentShape!};
            else if (hit?.type === 'frame') { chosen={id:hit.item.id,shape:hit.item.phone}; target='phone'; }
            else if (hit?.type === 'image') { chosen={id:hit.item.id,shape:hit.item.image}; target='screenshot'; }
            session.selectedOrnament = null; session.selectedText = null;
            if (!chosen) { session.activeObject='none'; session.render(); return; }
            session.activeObject=target; session.state.activeFrameId=chosen.id;
            const device=session.activeDevice(), shape=chosen.shape;
            session.pointerAction={target,type:rotateHandle?'rotate':handle?'resize':'move',start:point,shape,
                startAngle:Math.atan2(point.y-shape.cy,point.x-shape.cx),
                offsetX:target==='phone'?device.frameOffsetXPct:device.imageOffsetXPct,
                offsetY:target==='phone'?device.frameOffsetYPct:device.imageOffsetYPct,
                rotationDeg:target==='phone'?device.frameRotation:device.imageRotation};
        }
        session.render();
        session.canvas.setPointerCapture(e.pointerId);
        session.canvas.classList.add('dragging');
        e.preventDefault();
    });
    session.listen(window, 'pointerup', session.endPointer);
    session.listen(window, 'pointercancel', session.endPointer);
    session.workspaceHistoryButtons = { addSlide: true, duplicateSlide: true, deleteSlide: true, moveSlideLeft: true, moveSlideRight: true, resetBtn: true };
    session.bind('document', 'pointerdown', function (this: any, e: any): any {
        let target: any = e.target;
        if (target === session.canvas) {
            session.beginSlideHistory(session.state);
            return;
        }
        if (target.id === 'preset') {
            session.beginWorkspaceHistory();
            return;
        }
        let button: any = target.closest && target.closest('button');
        if (button) {
            if (button.id === 'undoBtn' || button.id === 'redoBtn' || button.id === 'downloadBtn' || button.id === 'downloadAllBtn')
                return;
            if (session.workspaceHistoryButtons[button.id])
                session.beginWorkspaceHistory();
            else
                session.beginSlideHistory(session.state);
            return;
        }
        if (target.matches && target.matches('select,input[type="range"],input[type="color"]'))
            session.beginSlideHistory(session.state);
    }, true);
    session.bind('document', 'input', function (this: any, e: any): any {
        if (e.target.matches && e.target.matches('select,input[type="range"],input[type="color"]'))
            session.beginSlideHistory(session.state);
    }, true);
    session.bind('document', 'focusin', function (this: any, e: any): any {
        if (e.target.matches && e.target.matches('textarea,input[type="text"],input[type="number"]'))
            session.beginInputHistory();
    });
    session.bind('document', 'focusout', function (this: any, e: any): any {
        if (e.target.matches && e.target.matches('textarea,input[type="text"],input[type="number"]'))
            session.commitInputHistory();
    });
    session.bind('document', 'click', function (this: any, e: any): any {
        let button: any = e.target.closest && e.target.closest('button');
        if (button && button.id !== 'undoBtn' && button.id !== 'redoBtn')
            session.commitHistoryTransaction();
    });
    session.bind('document', 'change', function (this: any, e: any): any {
        if (e.target.matches && e.target.matches('select,input[type="range"],input[type="color"]'))
            session.commitHistoryTransaction();
    });
    session.bind('undoBtn', 'click', function (this: any): any { session.performHistory('undo'); });
    session.bind('redoBtn', 'click', function (this: any): any { session.performHistory('redo'); });
    session.bind('document', 'keydown', function (this: any, e: any): any {
        if (session.selectedOrnament != null && (e.key === 'Delete' || e.key === 'Backspace') && !e.target.closest?.('input,textarea,select,[contenteditable]')) {
            e.preventDefault(); session.beginSlideHistory();
            session.state.ornaments = session.state.ornaments.filter(item => item.id !== session.selectedOrnament);
            session.selectedOrnament = null; session.activeObject = 'none'; session.commitHistoryTransaction(); session.render(); return;
        }
        if (!(e.ctrlKey || e.metaKey) || e.altKey || e.key.toLowerCase() !== 'z')
            return;
        e.preventDefault();
        session.performHistory(e.shiftKey ? 'redo' : 'undo');
    });
    session.bind('resetBtn', 'click', function (this: any): any {
        session.closeInlineEditor();
        session.selectedOrnament = null;
        session.selectedText = null;
        session.activeObject = 'phone';
        let index: any = session.activeSlideIndex(), oldId: any = session.state.id, currentPreset: any = session.state.preset, resetSlide: any = session.createBlankSlide();
        resetSlide.id = oldId;
        resetSlide.preset = currentPreset;
        session.slideCounter -= 1;
        session.slides[index] = resetSlide;
        session.state = resetSlide;
        session.$('fileInput').value = '';
        session.$('patternFileInput').value = '';
        session.render();
        session.showToast('Screenshot aktif direset.');
    });
    session.setCanvasZoom = function (mode: any, percent: any): any {
        session.canvasZoomMode = mode;
        if (typeof percent === 'number')
            session.canvasZoomPercent = session.clamp(Math.round(percent), 20, 200);
        session.fitPreviewCanvases();
    };
    session.currentCanvasZoomPercent = function (): any {
        let p: any = session.presets[session.state.preset], rect: any = session.canvas.getBoundingClientRect();
        return rect.width / p.w * 100;
    };
    session.bind('fitScreenBtn', 'click', function (this: any): any { session.setCanvasZoom('screen'); });
    session.bind('actualSizeBtn', 'click', function (this: any): any { session.setCanvasZoom('custom', 100); });
    session.bind('zoomOutBtn', 'click', function (this: any): any { session.setCanvasZoom('custom', (session.canvasZoomMode === 'custom' ? session.canvasZoomPercent : session.currentCanvasZoomPercent()) - 10); });
    session.bind('zoomInBtn', 'click', function (this: any): any { session.setCanvasZoom('custom', (session.canvasZoomMode === 'custom' ? session.canvasZoomPercent : session.currentCanvasZoomPercent()) + 10); });
}
