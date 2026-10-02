# Lumi — Softer, More Intentional

Two editable App Store slides, 1290 × 2796 px. Upright phones, matched framing, and two-line headlines. Soft plum and warm cream blobs meet at the shared edge. Four small decorative accents per slide, including heart, flower, star, and sparkle stickers.

## Import into the web editor

1. Open the editor and choose **JSON**.
2. Upload `lumi.json`.
3. Upload `reward shop.png` first (index 0), then `Cognitive Bias Validation.png` (index 1). Check the displayed order.
4. Click **Validasi**, then **Terapkan**.
5. Switch to **Visual** to edit text, colors, phone positions, or stickers. Use **Download semua** for PNGs.

The JSON references separate image files; keep both original images with the project. Reloading the editor clears its in-memory workspace, so re-import all three files when reopening.

## Files

- `01-little-wins.png`: midnight-plum Reward Bank slide.
- `02-little-friend.png`: cream mental-health introduction slide.
- `preview.png`: both slides side by side.
- `editor-preview.jpg`: captured editor state after re-import.

Typography uses Plus Jakarta Sans. Both source images are unchanged, including embedded Lumify branding. External text uses Lumi.

## Verification

Editor JSON validation and application passed. Re-import in the web editor passed. Editor serializer/parser round-trip retained two slides and the correct image references. Both PNGs are 1290 × 2796 pixels and were visually inspected.

The in-app browser download event stalled, so final PNGs were rendered locally using the editor's existing drawCanvas implementation with Plus Jakarta Sans weights 500 and 800. No editor code or APIs were changed.
