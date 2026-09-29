"use client";

export default function HomePage() {
  return (
    <main className="editor-shell" aria-label="Store Screenshot Generator">
      <iframe
        className="editor-frame"
        src="/store-screenshot-generator.html"
        title="Store Screenshot Generator"
      />
    </main>
  );
}
