import type { Slide } from './model';
import type { EditorSession } from './session';
export interface WorkspaceSnapshot {
    activeId: number;
    slides: Slide[];
}
export interface HistoryEntry<T> {
    before: T;
    after: T;
    seq: number;
}
export interface HistoryStacks<T> {
    undo: HistoryEntry<T>[];
    redo: HistoryEntry<T>[];
}
export type HistoryTransaction = {
    scope: 'slide';
    slide: Slide;
    before: Slide;
} | {
    scope: 'workspace';
    before: WorkspaceSnapshot;
};
export type HistoryAction = {
    scope: 'slide';
    entry: HistoryEntry<Slide>;
} | {
    scope: 'workspace';
    entry: HistoryEntry<WorkspaceSnapshot>;
};
export function installHistory(session: EditorSession) {
    session.slideHistoryById = {};
    session.workspaceUndo = [];
    session.workspaceRedo = [];
    session.historySequence = 0;
    session.historyTransaction = null;
    session.inputHistoryTransaction = null;
    session.historyObjectIds = new WeakMap();
    session.historyObjectCounter = 0;
    session.cloneHistoryValue = function (value: any): any {
        if (value === null || typeof value !== 'object')
            return value;
        if (typeof HTMLImageElement !== 'undefined' && value instanceof HTMLImageElement)
            return value;
        if (Array.isArray(value))
            return value.map(session.cloneHistoryValue);
        let copy: any = {};
        Object.keys(value).forEach(function (this: any, key: any): any { copy[key] = session.cloneHistoryValue(value[key]); });
        return copy;
    };
    session.historySignature = function (value: any): any {
        if (value === null || typeof value !== 'object')
            return JSON.stringify(value);
        if (typeof HTMLImageElement !== 'undefined' && value instanceof HTMLImageElement) {
            if (!session.historyObjectIds.has(value)) {
                session.historyObjectCounter += 1;
                session.historyObjectIds.set(value, session.historyObjectCounter);
            }
            return '"@image:' + session.historyObjectIds.get(value) + '"';
        }
        if (Array.isArray(value))
            return '[' + value.map(session.historySignature).join(',') + ']';
        return '{' + Object.keys(value).sort().map(function (this: any, key: any): any { return JSON.stringify(key) + ':' + session.historySignature(value[key]); }).join(',') + '}';
    };
    session.snapshotSlide = function (slide: Slide) { return session.cloneHistoryValue(slide); };
    session.snapshotWorkspace = function (): WorkspaceSnapshot { return { activeId: session.state.id, slides: session.slides.map(session.snapshotSlide) }; };
    session.slideHistory = function (slide: Slide) {
        if (!session.slideHistoryById[slide.id])
            session.slideHistoryById[slide.id] = { undo: [], redo: [] };
        return session.slideHistoryById[slide.id];
    };
    function clearRedo() {
        session.workspaceRedo = [];
        for (const history of Object.values(session.slideHistoryById)) history.redo = [];
    }
    session.recordSlideHistory = function (slide: Slide, before: Slide): boolean {
        if (!slide || !before)
            return false;
        let after = session.snapshotSlide(slide);
        if (session.historySignature(before) === session.historySignature(after))
            return false;
        let history = session.slideHistory(slide);
        session.historySequence += 1;
        history.undo.push({ before: before, after: after, seq: session.historySequence });
        clearRedo();
        session.notify();
        return true;
    };
    session.recordWorkspaceHistory = function (before: WorkspaceSnapshot): boolean {
        if (!before)
            return false;
        let after = session.snapshotWorkspace();
        if (session.historySignature(before) === session.historySignature(after))
            return false;
        session.historySequence += 1;
        session.workspaceUndo.push({ before: before, after: after, seq: session.historySequence });
        clearRedo();
        session.notify();
        return true;
    };
    session.restoreSlideSnapshot = function (slide: Slide, snapshot: Slide) {
        Object.assign(slide, session.cloneHistoryValue(snapshot));
    };
    session.refreshAfterHistory = function () {
        session.closeInlineEditor();
        session.pointerAction = null;
        session.selectedOrnament = null;
        session.selectedText = null;
        session.activeObject = 'phone';
        session.render();
        session.notify();
    };
    session.restoreWorkspaceSnapshot = function (snapshot: WorkspaceSnapshot) {
        session.slides = snapshot.slides.map(session.snapshotSlide);
        session.state = session.slides.find(function (this: any, slide: any): any { return slide.id === snapshot.activeId; }) || session.slides[0];
        session.slideCounter = Math.max(session.slideCounter, ...session.slides.map(slide => slide.id));
        session.ornamentCounter = Math.max(session.ornamentCounter, 0, ...session.slides.flatMap(slide => slide.ornaments.map(item => item.id)));
        session.frameCounter = Math.max(session.frameCounter, ...session.slides.flatMap(slide => slide.frames.map(device => device.id)));
        session.refreshAfterHistory();
    };
    session.newestHistoryAction = function (direction: 'undo' | 'redo'): HistoryAction | null {
        let history = session.slideHistory(session.state), slideStack = direction === 'undo' ? history.undo : history.redo;
        let workspaceStack = direction === 'undo' ? session.workspaceUndo : session.workspaceRedo;
        let slideEntry = slideStack[slideStack.length - 1], workspaceEntry = workspaceStack[workspaceStack.length - 1];
        if (!slideEntry)
            return workspaceEntry ? { scope: 'workspace', entry: workspaceEntry } : null;
        if (!workspaceEntry)
            return { scope: 'slide', entry: slideEntry };
        const workspaceFirst = direction === 'undo' ? workspaceEntry.seq > slideEntry.seq : workspaceEntry.seq < slideEntry.seq;
        return workspaceFirst ? { scope: 'workspace', entry: workspaceEntry } : { scope: 'slide', entry: slideEntry };
    };
    session.performHistory = function (direction: 'undo' | 'redo') {
        session.commitInputHistory();
        session.commitHistoryTransaction();
        let picked = session.newestHistoryAction(direction);
        if (!picked)
            return;
        if (picked.scope === 'workspace') {
            let from = direction === 'undo' ? session.workspaceUndo : session.workspaceRedo;
            let to = direction === 'undo' ? session.workspaceRedo : session.workspaceUndo;
            let workspaceEntry = from.pop()!;
            to.push(workspaceEntry);
            session.restoreWorkspaceSnapshot(direction === 'undo' ? workspaceEntry.before : workspaceEntry.after);
        }
        else {
            let history = session.slideHistory(session.state), fromSlide = direction === 'undo' ? history.undo : history.redo, toSlide = direction === 'undo' ? history.redo : history.undo;
            let slideEntry = fromSlide.pop()!;
            toSlide.push(slideEntry);
            session.restoreSlideSnapshot(session.state, direction === 'undo' ? slideEntry.before : slideEntry.after);
            session.refreshAfterHistory();
        }
    };
    session.beginSlideHistory = function (slide?: Slide) {
        if (session.historyTransaction)
            return;
        session.historyTransaction = { scope: 'slide', slide: slide || session.state, before: session.snapshotSlide(slide || session.state) };
    };
    session.beginWorkspaceHistory = function () {
        if (session.historyTransaction)
            return;
        session.historyTransaction = { scope: 'workspace', before: session.snapshotWorkspace() };
    };
    session.commitHistoryTransaction = function () {
        if (!session.historyTransaction)
            return;
        let transaction = session.historyTransaction;
        session.historyTransaction = null;
        if (transaction.scope === 'workspace')
            session.recordWorkspaceHistory(transaction.before);
        else
            session.recordSlideHistory(transaction.slide, transaction.before);
    };
    session.beginInputHistory = function () {
        if (!session.inputHistoryTransaction)
            session.inputHistoryTransaction = { slide: session.state, before: session.snapshotSlide(session.state) };
    };
    session.commitInputHistory = function () {
        if (!session.inputHistoryTransaction)
            return;
        let transaction = session.inputHistoryTransaction;
        session.inputHistoryTransaction = null;
        session.recordSlideHistory(transaction.slide, transaction.before);
    };
}
