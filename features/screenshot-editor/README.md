# Screenshot editor

The Next.js page renders `ScreenshotEditor` directly. React owns controls, slide cards, panels, and inline text editing. Canvas elements remain mounted while gestures run.

- `components/`: major screen areas, receiving snapshots and actions through props.
- `useEditor.ts`: owns one editor session, React snapshots, browser listeners, redraw scheduling, and cleanup.
- `controller.ts`: editor actions and control event bindings. Bindings are called by React handlers; they do not install control DOM listeners.
- `model.ts` and `history.ts`: slide/device defaults, copies, and grouped slide/workspace undo transactions.
- `canvas.ts`: drawing, layout geometry, hit testing, and gesture math. `drawCanvas` accepts the slide explicitly; exports and thumbnails leave active state and selection geometry intact.
- `ornaments.ts`: built-in vector catalog, shape painting, selection priority, and ornament commands. Shapes use percentages of output dimensions. Back/front buckets each follow array order.
- `textStyles.ts`: six text presets, with font-relative effects shared by preview and PNG. A null text color means automatic contrast.
- `assets.ts`: image resources, mockup cache, font readiness, and cancellation.
- `export.ts`: full-resolution PNG encoding and ordered downloads.
- `session.ts`: the typed contract between these files.
- `editor.css`: existing editor styling, including responsive and color-scheme rules.

To add a control, place its markup in the owning screen component, add the field/default to `model.ts`, and bind its action in `controller.ts`. Keep history transactions around a whole edit or gesture. Drawing changes belong in `canvas.ts`; ornament paths and text effects belong in their dedicated painters. New React controls can call typed actions in `useEditor.ts`.

The sidebar orders Format output, Frame & screenshot, Teks, Background, and Ornamen. Each accordion keeps its own open state; canvas selection never opens a panel. Frame starts open. Advanced transformations live in native disclosure sections. Selecting an ornament exposes its properties; Delete/Backspace removes it when focus is outside editable controls.

Mockup assets remain in `public/mockup`. `npm run prepare:mockups` generates both the compatibility `frames.js` and the React metadata in `frame-specs.json`.

Run `npm test`, `npm run typecheck`, and `npm run build`. State and uploaded images remain in memory; reloading starts a new workspace.

## Visual / AI Chat

Both tabs share one editor session. AI Chat keeps uploads and conversation in memory across tab switches. Uploading PNG/JPG/WebP screenshots first creates WebP vision copies at quality 0.8, bounded to 1600×1600 without upscaling (PNG fallback preserves transparency). Canvas and PNG export use the original images.

Vision analysis recommends a direction without changing canvas. **Approve & Generate** creates one slide per upload in order and replaces the set as a single Undo/Redo transaction. Later explicit changes use editor commands. Select **Explore a new design direction** for a fresh recommendation and approval. Failed or stale responses leave the workspace intact.

Configure server-only `SUMOPOD_API_KEY`, `SUMOPOD_CHAT_URL`, and `SUMOPOD_MODEL` using `.env.example`; `.env` is ignored. The route `/api/ai/chat` uses non-streaming strict JSON schema output. `ai.ts` derives the provider schema from the editor schema; `__omit__` represents optional omitted fields, while native null values retain their meaning. The existing parser and detached config runtime validate all canvas changes. `getProject()` returns state and indexed assets without downloading.

`scripts/verify-ai.mjs` is an optional live integration check using compressed repository samples; it makes paid provider requests. Run against a local server with `AI_TEST_URL=http://localhost:3000/api/ai/chat node scripts/verify-ai.mjs`. Set `NEXT_BUILD_DIR` to a separate ignored `.next-*` directory when building alongside an active dev server.

The JSON editor engine remains the canvas integration contract:

- `config.ts`: tipe, schema ketat, parser, dan contoh.
- `configRuntime.ts`: serializer, pemetaan ID, staging, dan executor.
- `frameGeometry.ts`: geometri mockup yang digunakan renderer, susunan frame, dan export JSON.
- `components/AiChat.tsx`: uploads, recommendations, approval, chat requests, cancellation, and stale response checks.
- `aiImages.ts`: cached compressed vision copies; original images stay unchanged.
- `configs/schema.json`: JSON Schema v1. `project.json`, `template.json`, and `commands.json` are engine examples. `complete-project.json` demonstrates all fields and shared image resources.

### Config

Semua config wajib `version: 1` dan `kind: "project" | "template" | "commands"`. Properti tidak dikenal, enum/angka salah, ID duplikat, dan referensi gambar hilang ditolak dengan lokasi field. JSON hanya data; tidak ada evaluasi JavaScript atau API browser global.

`project` memiliki `preset` global (`app67`: 1290×2796, `app65`: 1242×2208, `play`: 1080×1920) dan `slides` berurutan. Setiap slide memiliki ID string stabil, `layout` (`top`, `left`, `bottom`), `background`, `headline`, `subheadline`, `frames`, dan `ornaments`. Field opsional memakai default editor. Frames yang dihilangkan menghasilkan satu frame; `frames: []` ditolak. Ornamen default kosong.

Teks: `content`, `font`, `size`, `style: {preset, color, accent}`, `x`, `y`, `scale`, `rotation`. Style preset: `normal`, `shadow`, `outline`, `gradient`, `highlight`, `neon`. `color: null` memakai kontras otomatis. Posisi teks adalah offset persen dari posisi layout; rotasi dalam derajat.

Frame: `id`, `kind`, `imageIndex`, `transform`, `zoom`, `imageFit`, `screenPanX/Y`, `imageOffsetXPct/YPct`, `imageWidthPct/HeightPct`, `imageRotation`, `frameZoom`, `frameRotation`, `frameWidthPct/HeightPct`, `frameOffsetXPct/YPct`, `shadowEnabled/Color/Opacity/Blur/OffsetX/OffsetY`. Image pan/offset/ukuran tetap memakai persen; image offset dihitung dari sudut kiri atas. Model valid tercantum dalam schema.

Mockup memakai `transform: {x, y, width, scale, rotation}`. `x/y` adalah posisi pusat dalam persen canvas (`50,50` = tengah), `width` persen lebar canvas sebelum skala, `scale` pengali ukuran (0.35–1.7), dan `rotation` derajat. Tinggi mengikuti proporsi model. Posisi boleh keluar canvas. Field yang dihilangkan menggunakan default saat import atau mempertahankan nilai saat update. Array `frames` dapat berisi beberapa mockup, dengan gambar sama atau berbeda.

Config lama v1 masih menerima `frameOffsetXPct/YPct`, `frameWidthPct/HeightPct`, `frameZoom`, dan `frameRotation`. Jangan campurkan keenam field tersebut dengan `transform` pada frame yang sama. Export JSON selalu menulis transform eksplisit, termasuk ukuran dari layout dan gesture. Contoh project panel JSON menampilkan dua mockup miring memakai gambar index 0 yang sama.

Background: `backgroundType`, `color`, `gradientColor1/2`, `gradientAngle`, `patternType`, `patternBaseColor`, `patternInkColor`, `patternScale`, `patternOpacity`, `imageIndex`. Pattern `upload` memerlukan gambar ketika background pattern aktif.

Ornamen: `id`, `kind`, `x`, `y`, `width`, `height`, `rotation`, `color`, `opacity`, `layer` (`back`/`front`). Posisi dan ukuran adalah persen canvas; opacity 0–100. Bentuk: circle, rectangle, line, arrow, star, sparkle, blob. Urutan array menentukan urutan dalam lapisan.

`imageIndex` adalah index upload **0-based**, untuk screenshot maupun pattern. `null` melepas gambar. `template` memakai satu `slide` dan mengganti `imageIndex: "$current"` dengan setiap file sesuai urutan; menghasilkan satu slide per gambar. `$current` hanya berlaku dalam template. Tombol pindah/hapus menentukan pasangan sebelum Terapkan.

Export JSON menghasilkan project eksplisit dengan transformasi terkini, ID stabil, dan `assets: [{index, name}]`. Satu objek gambar yang dipakai berulang mendapat satu index. Gambar tidak disisipkan ke JSON: upload kembali file sesuai manifest ketika membuka config di session baru. Manifest adalah keterangan urutan, bukan sumber gambar. Tombol Export JSON juga memperbarui draft dan daftar resource dalam session saat ini.

### Commands

Envelope: `{"version":1,"kind":"commands","commands":[...]}`. Target `slide`, `frame`, dan `ornament` memakai ID string dari project/Export JSON. Target frame/ornamen dicari dalam slide yang disebutkan. Batch dijalankan berurutan pada salinan session, sehingga operasi berikutnya dapat memakai ID yang baru dibuat; target atau operasi terakhir salah membatalkan seluruh batch.

| Operasi | Field selain `op` |
| --- | --- |
| `slide.add` | `value` opsional, definisi slide |
| `slide.duplicate` | `slide`, `id` baru |
| `slide.delete`, `slide.select`, `slide.reset` | `slide` |
| `slide.move` | `slide`, `index` 0-based posisi akhir |
| `slide.update` | `slide`, `value` berisi properti slide parsial |
| `frame.add` | `slide`, `value` definisi frame |
| `frame.duplicate` | `slide`, `frame` sumber, `id` baru; duplikat disisipkan setelah sumber |
| `frame.update` | `slide`, `frame`, `value` parsial |
| `frame.delete`, `frame.select` | `slide`, `frame` |
| `frame.arrange` | `slide`, `arrangement`: `cascade` / `sideBySide` |
| `ornament.add` | `slide`, `value` definisi ornamen |
| `ornament.update` | `slide`, `ornament`, `value` parsial |
| `ornament.delete`, `ornament.select` | `slide`, `ornament` |
| `ornament.move` | `slide`, `ornament`, `direction`: `forward` / `backward` dalam lapisan |
| `preset` | `value`: `app67`, `app65`, `play` |
| `zoom` | `mode`: `screen` / `custom`; `percent` wajib untuk custom |
| `undo`, `redo`, `export.active`, `export.all` | tanpa field tambahan; wajib command tunggal |

`slide.update` mengatur background, teks, efek, transformasi, layout, dan dapat mengganti array frame/ornamen lengkap. `frame.update` dengan `imageIndex` memasang/melepas screenshot. `ornament.update` dengan `layer` memindahkan lapisan. Reset mempertahankan preset global. Command posisi menetapkan nilai akhir; gesture tidak direplay. Zoom adalah pengaturan workspace tampilan. Undo/redo serta ekspor harus terpisah dari batch desain; PNG hanya diunduh ketika Terapkan diklik, tidak ketika project/template diimpor.

Contoh lengkap semua field dapat dibuat dengan **Export JSON** dari desain Visual; batas, enum, dan field lengkap ada di `configs/schema.json`. Ketika menambah pengaturan visual, perbarui model, schema, serializer, executor, dan tes round-trip bersamaan.

Duplikat frame mempertahankan gambar dan seluruh pengaturan, dengan ID baru dan properti yang independen. Frame duplikat menjadi frame aktif pada slide target; slide aktif tidak berubah. Contoh commands menjalankan duplikasi `phone` lalu mengatur posisi, ukuran, skala, dan rotasi `phone-copy` dalam satu Undo.

## Stiker

Panel **Ornamen & Stiker → Stiker** menyediakan 54 ilustrasi original: 24 doodle, 16 emoji/objek, dan 14 label. Cari nama atau ID dalam kategori aktif; jumlah hasil tampil di bawah pencarian. Pencarian dan kategori tidak mengubah seleksi canvas. Painter vector di `stickerPainter.ts` dipakai oleh thumbnail, preview, dan PNG; artwork per kategori berada di `stickerDoodles.ts`, `stickerEmoji.ts`, dan `stickerLabels.ts`, dengan helper path di `stickerPaths.ts`. Definisi katalog serta operasi tambah/upload berada di `stickers.ts`. Tambah stiker katalog dengan menambah ID/nama/proporsi di katalog serta entry pada registry painter kategorinya. Tidak ada fallback artwork untuk ID yang tidak dikenal; perbarui schema dengan `configSchema` dari `config.ts`.

Doodle dan label memiliki warna yang dapat diedit; label menerima tulisan sampai 40 karakter. Emoji dan upload memakai warna aslinya. Upload hanya menerima PNG/WebP, termasuk transparansi. Beberapa file dimuat seluruhnya sebelum ditambahkan sebagai satu transaksi; kegagalan satu file membatalkan seluruh upload.

Stiker berada dalam array `ornaments` bersama shape, sehingga urutan depan/belakang bisa bercampur. `x/y` adalah pusat dalam persen canvas; `width/height` adalah persen lebar/tinggi canvas. Dimensi yang dihilangkan mengikuti lebar 20% dan proporsi sumber. Resize canvas selalu menjaga proporsi saat gesture dimulai. `lockAspect` (default `true`) mengatur pengunci ukuran di panel; JSON boleh menentukan kedua dimensi secara eksplisit.

```json
{
  "id": "wow-badge", "kind": "sticker", "source": "catalog",
  "stickerId": "label-wow", "text": "WOW!", "color": "#ff78aa",
  "x": 80, "y": 30, "width": 20, "height": 8,
  "rotation": -12, "opacity": 100, "layer": "front", "lockAspect": true
}
```

Upload memakai `{"id":"my-sticker","kind":"sticker","source":"upload","imageIndex":1}`. Index berasal dari daftar upload yang sama dengan screenshot/pattern; template boleh memakai `$current`. Gambar tetap file terpisah, dan manifest ekspor hanya mendaftarkan resource yang sama sekali. SVG upload, URL eksternal, dan JavaScript tidak diterima.

ID katalog:
- Doodle: `doodle-heart`, `doodle-arrow`, `doodle-star`, `doodle-circle`, `doodle-lightning`, `doodle-flower`.
- Emoji: `emoji-smile`, `emoji-laugh`, `emoji-heart-eyes`, `emoji-cool`, `emoji-fire`, `emoji-eyes`.
- Label: `label-wow`, `label-new`, `label-love-it`, `label-omg`, `label-try-it`, `label-so-good`.

Tambahan ID katalog (seluruh ID lama dipertahankan):
- Doodle: `doodle-arrow-curved`, `doodle-arrow-loop`, `doodle-arrow-double`, `doodle-underline-wave`, `doodle-zigzag`, `doodle-sparkles`, `doodle-burst`, `doodle-sun`, `doodle-moon`, `doodle-cloud`, `doodle-rainbow`, `doodle-spiral`, `doodle-check`, `doodle-exclamation`, `doodle-question`, `doodle-crown`, `doodle-leaf`, `doodle-butterfly`.
- Emoji/objek: `emoji-wink`, `emoji-kiss`, `emoji-party`, `emoji-happy-cry`, `emoji-shocked`, `emoji-thinking`, `emoji-thumbs-up`, `emoji-peace`, `emoji-rocket`, `emoji-planet`.
- Label: `label-yay` (burst), `label-cool` (pill), `label-hot` (tiket), `label-hello` (balon percakapan), `label-nice` (awan), `label-lets-go` (pita), `label-100` (badge bergerigi), `label-note` (sticky note).

Semua command `ornament.*` mendukung stiker. Alias tersedia sebagai `sticker.add/update/delete/select/duplicate/move/reorder`; alias dengan target memakai field `sticker` (bukan `ornament`) dan menolak target shape. `ornament.duplicate` juga tersedia. `move/reorder` memakai `direction: "forward" | "backward"` dalam lapisan yang sama; perpindahan lapisan memakai `update` dengan `layer`. Shape lama tetap boleh berganti bentuk melalui update. Pergantian antara shape/stiker atau antara sumber katalog/upload memakai hapus lalu tambah elemen baru. Batch tetap atomik dan satu Undo.

```json
{
  "version": 1, "kind": "commands",
  "commands": [
    {"op":"sticker.add","slide":"home","value":{"id":"wow","kind":"sticker","source":"catalog","stickerId":"label-wow"}},
    {"op":"sticker.duplicate","slide":"home","sticker":"wow","id":"wow-copy"},
    {"op":"sticker.update","slide":"home","sticker":"wow-copy","value":{"x":80,"y":30,"rotation":-12,"text":"LOVE IT","color":"#ff78aa"}},
    {"op":"sticker.select","slide":"home","sticker":"wow-copy"}
  ]
}
```

`configs/stickers-project.json` memadukan frame, shape, stiker katalog, dan stiker upload; unggah screenshot sebagai index 0 dan stiker transparan sebagai index 1. `configs/stickers-commands.json` memperlihatkan duplikasi, transformasi, dan urutan stiker pada project tersebut. Config v1 lama tetap kompatibel. `configs/rich-stickers-project.json` memakai doodle, roket, dan label baru; upload satu screenshot sebagai index 0. `configs/rich-stickers-commands.json` menambahkan planet dan menduplikasi label dalam satu transaksi.

Semua stiker memakai border putih `#ffffff`, dengan ketebalan 4% sisi terpendek dan tetap berada di dalam ukuran stiker. Border mengikuti siluet katalog atau alpha upload, termasuk saat rotasi, opacity, thumbnail, dan ekspor PNG. Border otomatis berlaku pada JSON v1 tanpa properti tambahan.

## Hybrid AI provider

Set server-only `SUMOPOD_API_KEY`, `SUMOPOD_CHAT_URL`,
`SUMOPOD_VISION_MODEL=gpt-4o-mini`, and
`SUMOPOD_DESIGN_MODEL=deepseek-v4.1-flash:netra` (see `.env.example`).
`GET /api/ai/chat` exposes model labels only.

Vision reads compressed copies (1600px maximum, WebP quality 0.8 / PNG fallback);
originals remain the canvas/export assets. Facts are cached in memory by image bytes,
endpoint and vision model for one hour, with a 128-entry limit. DeepSeek receives
facts and editor context, never uploaded image bytes; thinking is disabled.

`aiPlan.ts` defines the compact strict vision, design and edit schemas from editor
enums/bounds. Its compiler fills explicit defaults, preserves meaningful nulls,
creates stable IDs and maps upload N to slide N. Recommendations show compiled
colors, fonts, copy and ornaments. Approval revalidates those exact slides and does
not call a provider. Edits compile real canvas IDs to commands and stage them before
returning. Local atomic application, signature checks and Undo remain authoritative.

All provider calls require native `json_schema` with `strict: true`; no JSON-mode
fallback. Invalid JSON, truncation and validation failures permit two repairs using
validation paths and the same request snapshot. Authentication, refusal and rejected
schemas never retry automatically. The whole route has a 110-second deadline. Error
responses include code, detail, retryability and public model labels; credentials
and upstream response bodies are never logged.

Run `AI_TEST_COUNT=1 node scripts/verify-ai.mjs`, then counts 3 and 10, with the local
server running. These exercise the actual provider schemas, approval without a
second generation call, original asset mapping, targeted edits and Undo/Redo.
Browser verification separately covers canvas rendering and PNG downloads.
