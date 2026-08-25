"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  if (process.env.NODE_ENV !== "production") console.error(error);
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily: "system-ui, sans-serif",
          background: "#f7f8f6",
          color: "#1b2420",
        }}
      >
        <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: "2rem" }}>
          <div style={{ maxWidth: "28rem", textAlign: "center" }}>
            <p style={{ fontSize: "0.7rem", letterSpacing: "0.08em", textTransform: "uppercase", color: "#5f6b64" }}>
              Something went wrong
            </p>
            <h1 style={{ fontSize: "1.75rem", fontWeight: 600, marginTop: "0.75rem" }}>
              The page failed to load.
            </h1>
            <p style={{ marginTop: "0.75rem", color: "#5a6660", lineHeight: 1.6, fontSize: "0.9rem" }}>
              Nothing was lost — your record and its audit chain are intact.
              {error.digest ? ` Ref ${error.digest}` : ""}
            </p>
            <button
              onClick={reset}
              style={{
                marginTop: "1.75rem",
                height: "2.75rem",
                padding: "0 1.25rem",
                borderRadius: "0.375rem",
                border: "1px solid #1a56c4",
                background: "#1a56c4",
                color: "#fff",
                fontSize: "0.875rem",
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Try again
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
