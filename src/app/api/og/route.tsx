import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { readFileSync } from "node:fs";
import path from "node:path";

export const dynamic = "force-dynamic";

// Bundled Geist font (ships with next/og) — avoids runtime font downloads.
const FONT_PATH = path.join(process.cwd(), "public/fonts/Geist-Regular.ttf");

// Site palette — mirrors the Tailwind tokens in src/app/globals.css.
// No external fonts, images, or network fetches at runtime.
const BG = "#0a0e0c";
const LINE = "#1e2924";
const FG = "#dbe7e0";
const DIM = "#7c9288";
const ACCENT = "#34d399";
const CYAN = "#22d3ee";

const MONO =
  'Geist, ui-monospace, "SF Mono", SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';

/** Strip HTML and collapse whitespace from query params before rendering. */
function clean(input: string): string {
  return input
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Dynamic OG social preview card (1200x630 PNG).
 * ?title=&tags=&excerpt=&slug= — renders a terminal/cyan card matching the
 * site aesthetic. Runs at request time; no cached or static state.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const title = clean(sp.get("title") ?? "Untitled post").slice(0, 160);
  const excerpt = clean(sp.get("excerpt") ?? "").slice(0, 240);
  const slug = clean(sp.get("slug") ?? "");
  const tags = (sp.get("tags") ?? "")
    .split(",")
    .map((t) => clean(t))
    .filter(Boolean)
    .slice(0, 5);

  try {
    let fontData: Buffer | undefined;
    try {
      fontData = readFileSync(FONT_PATH);
    } catch {
      // font missing — fall back to next/og defaults
    }

    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            backgroundColor: BG,
            color: FG,
            fontFamily: MONO,
            padding: "72px 76px",
          }}
        >
          {/* top row: terminal window dots + brand wordmark */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", gap: "12px" }}>
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: 999,
                    backgroundColor: i === 2 ? ACCENT : LINE,
                  }}
                />
              ))}
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "14px",
                fontSize: 34,
                letterSpacing: -1,
              }}
            >
              <span style={{ color: CYAN }}>$</span>
              <span style={{ color: ACCENT, fontWeight: 700 }}>Technography</span>
              <span style={{ color: DIM }}>blog</span>
            </div>
          </div>

          {/* divider */}
          <div style={{ height: 2, backgroundColor: LINE, marginTop: 36 }} />

          {/* title + excerpt */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              flex: 1,
              marginTop: 44,
            }}
          >
            <div
              style={{
                fontSize: 64,
                fontWeight: 700,
                lineHeight: 1.18,
                letterSpacing: -1,
                color: FG,
              }}
            >
              {title}
            </div>
            {excerpt ? (
              <div
                style={{
                  fontSize: 26,
                  lineHeight: 1.5,
                  color: DIM,
                  marginTop: 28,
                  maxWidth: 900,
                }}
              >
                {excerpt}
              </div>
            ) : null}
          </div>

          {/* tag chips */}
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            {(tags.length > 0 ? tags : ["blog"]).map((t) => (
              <div
                key={t}
                style={{
                  display: "flex",
                  alignItems: "center",
                  border: `1px solid ${LINE}`,
                  borderRadius: 8,
                  padding: "8px 18px",
                  fontSize: 24,
                  color: CYAN,
                }}
              >
                #{t}
              </div>
            ))}
          </div>

          {/* footer status line */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginTop: 48,
            }}
          >
            <div style={{ display: "flex", fontSize: 26, color: DIM }}>
              <span>~$ cat ./posts/</span>
              <span>{slug || "draft"}</span>
              <span>.md</span>
            </div>
            <div style={{ display: "flex", fontSize: 26, color: DIM }}>
              <span style={{ color: ACCENT }}>&gt;_</span>
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
        ...(fontData
          ? {
              fonts: [
                {
                  name: "Geist",
                  data: fontData,
                  weight: 400 as const,
                  style: "normal" as const,
                },
              ],
            }
          : {}),
      }
    );
  } catch {
    return new Response("Failed to generate the image", { status: 500 });
  }
}
