#!/usr/bin/env node
/**
 * scripts/send-digest.js
 *
 * Builds a weekly digest of the 5 most recent non-premium Technography
 * posts and creates it as a Listmonk campaign.
 *
 * DRY-RUN BY DEFAULT: the campaign is created with status "draft" and
 * send_at null — it is never sent to real subscribers.
 *
 *   node scripts/send-digest.js            # creates a DRAFT campaign (safe)
 *   node scripts/send-digest.js --send-now # creates the campaign AND starts
 *                                          #   it (status "running") — sends!
 *
 * Reads LISTMONK_URL, LISTMONK_USER, LISTMONK_TOKEN and the optional
 * LISTMONK_LIST_ID from .env.local at runtime. Credentials are never
 * hardcoded, printed, or logged. Also accepts LISTMONK_USERNAME /
 * LISTMONK_PASSWORD as alternative variable names.
 *
 * Requires Node 18+ (global fetch).
 */
"use strict";

const fs = require("fs");
const path = require("path");

const REPO_ROOT = path.resolve(__dirname, "..");
const POSTS_DIR = path.join(REPO_ROOT, "content", "posts");
const ENV_FILE = path.join(REPO_ROOT, ".env.local");

const BLOG_BASE_URL = "https://deepukhadgi.com.np/blog";
const DIGEST_SUBJECT = "Technography weekly digest";
const MAX_POSTS = 5;

/* ------------------------------------------------------------------ */
/* Tiny .env parser — no dotenv dependency                             */
/* ------------------------------------------------------------------ */
function loadEnv(file) {
  const env = {};
  if (!fs.existsSync(file)) return env;
  const text = fs.readFileSync(file, "utf8");
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

/* ------------------------------------------------------------------ */
/* Minimal frontmatter parser (fields between --- markers)             */
/* ------------------------------------------------------------------ */
function parseFrontmatter(raw) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;
  const fields = {};
  for (const line of match[1].split(/\r?\n/)) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    fields[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  return fields;
}

function unquote(value) {
  if (!value) return "";
  const v = value.trim();
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    return v.slice(1, -1);
  }
  return v;
}

function parseTags(value) {
  if (!value) return [];
  const v = value.trim();
  if (v.startsWith("[")) {
    try {
      const arr = JSON.parse(v);
      return Array.isArray(arr) ? arr.map(String) : [];
    } catch {
      // Not strict JSON — split manually.
      return v
        .slice(1, -1)
        .split(",")
        .map((t) => unquote(t))
        .filter(Boolean);
    }
  }
  return [unquote(v)];
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function formatDate(d) {
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

function loadPosts() {
  const posts = [];
  for (const file of fs.readdirSync(POSTS_DIR)) {
    if (!file.endsWith(".md")) continue;
    const raw = fs.readFileSync(path.join(POSTS_DIR, file), "utf8");
    const fm = parseFrontmatter(raw);
    if (!fm || !fm.title || !fm.date) continue;
    const date = new Date(unquote(fm.date));
    if (Number.isNaN(date.getTime())) continue;
    posts.push({
      slug: file.replace(/\.md$/, ""),
      title: unquote(fm.title),
      date,
      dateLabel: formatDate(date),
      excerpt: unquote(fm.excerpt),
      tags: parseTags(fm.tags),
      premium: String(fm.premium).trim().toLowerCase() === "true",
    });
  }
  return posts.sort((a, b) => b.date - a.date);
}

/* ------------------------------------------------------------------ */
/* HTML email                                                          */
/* ------------------------------------------------------------------ */
function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildHtml(posts, generatedLabel) {
  const items = posts
    .map(
      (p) => `
      <tr>
        <td style="padding:0 0 30px 0;">
          <h2 style="margin:0 0 4px 0;font-size:18px;line-height:1.35;font-family:Arial,Helvetica,sans-serif;">
            <a href="${BLOG_BASE_URL}/${p.slug}" style="color:#111827;text-decoration:none;">${escapeHtml(p.title)}</a>
          </h2>
          <p style="margin:0 0 8px 0;font-size:12px;color:#6b7280;font-family:Arial,Helvetica,sans-serif;">${p.dateLabel}</p>
          ${p.excerpt ? `<p style="margin:0;font-size:14px;line-height:1.6;color:#374151;font-family:Arial,Helvetica,sans-serif;">${escapeHtml(p.excerpt)}</p>` : ""}
        </td>
      </tr>`
    )
    .join("\n");

  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background-color:#f4f4f5;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border:1px solid #e4e4e7;border-radius:8px;">
            <!-- header -->
            <tr>
              <td style="padding:28px 32px 8px 32px;">
                <p style="margin:0 0 4px 0;font-size:12px;color:#6b7280;font-family:monospace;">Technography</p>
                <h1 style="margin:0;font-size:24px;line-height:1.3;color:#18181b;font-family:Arial,Helvetica,sans-serif;">Weekly digest — ${generatedLabel}</h1>
                <p style="margin:10px 0 0 0;font-size:13px;line-height:1.5;color:#6b7280;font-family:Arial,Helvetica,sans-serif;">
                  The latest from my self-hosted corner of the internet: homelab, Docker, Linux, and the AI tooling that runs it all.
                </p>
              </td>
            </tr>
            <!-- posts -->
            <tr>
              <td style="padding:24px 32px 8px 32px;">
                ${items}
              </td>
            </tr>
            <!-- footer -->
            <tr>
              <td style="padding:20px 32px 28px 32px;border-top:1px solid #e4e4e7;">
                <p style="margin:0;font-size:12px;line-height:1.6;color:#a1a1aa;font-family:Arial,Helvetica,sans-serif;">
                  You're receiving this because you subscribed to the Technography newsletter.
                  <br />Read everything at <a href="https://deepukhadgi.com.np" style="color:#6b7280;">deepukhadgi.com.np</a>.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

/* ------------------------------------------------------------------ */
/* Listmonk API                                                        */
/* ------------------------------------------------------------------ */
function authHeader(user, token) {
  return `Basic ${Buffer.from(`${user}:${token}`).toString("base64")}`;
}

async function createCampaign(env, html, sendNow) {
  const base = String(env.LISTMONK_URL || "").replace(/\/+$/, "");
  if (!base) {
    throw new Error("LISTMONK_URL is missing from .env.local");
  }
  const user = env.LISTMONK_USER || env.LISTMONK_USERNAME;
  const token = env.LISTMONK_TOKEN || env.LISTMONK_PASSWORD;
  if (!user || !token) {
    throw new Error(
      "Listmonk credentials missing from .env.local (need LISTMONK_USER/LISTMONK_TOKEN)"
    );
  }
  const listId = Number(env.LISTMONK_LIST_ID || "1");

  const name = `Weekly digest — ${new Date().toISOString().slice(0, 10)}`;
  const headers = {
    Authorization: authHeader(user, token),
    "Content-Type": "application/json",
  };

  // Draft by default: send_at null + status "draft" = never sent.
  const res = await fetch(`${base}/api/campaigns`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name,
      subject: DIGEST_SUBJECT,
      type: "regular",
      lists: [listId],
      content_type: "html",
      body: html,
      send_at: null,
      status: sendNow ? "running" : "draft",
    }),
  });

  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(
      `Listmonk API error ${res.status}: ${JSON.stringify(json)}`
    );
  }
  const campaign = json && json.data ? json.data : json;

  // --send-now: the documented way to start a campaign is the status
  // endpoint (POST create always yields a draft); do it explicitly.
  if (sendNow && campaign && campaign.id) {
    const statusRes = await fetch(`${base}/api/campaigns/${campaign.id}/status`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ status: "running" }),
    });
    if (!statusRes.ok) {
      const statusJson = await statusRes.json().catch(() => null);
      throw new Error(
        `Failed to start campaign ${campaign.id}: Listmonk API error ${statusRes.status}: ${JSON.stringify(statusJson)}`
      );
    }
  }

  return campaign;
}

/* ------------------------------------------------------------------ */
/* Main                                                                */
/* ------------------------------------------------------------------ */
async function main() {
  const sendNow = process.argv.includes("--send-now");

  const env = loadEnv(ENV_FILE);
  const posts = loadPosts().filter((p) => !p.premium).slice(0, MAX_POSTS);

  if (posts.length === 0) {
    throw new Error("No non-premium posts found with frontmatter");
  }

  const generatedLabel = formatDate(new Date());
  const html = buildHtml(posts, generatedLabel);
  const campaign = await createCampaign(env, html, sendNow);

  console.log(
    `Campaign #${campaign.id} created with status "${campaign.status}"` +
      (sendNow
        ? " (--send-now: RUNNING — will send to subscribers)"
        : " (draft — dry run, nothing sent)")
  );
  console.log(
    `Digest covers ${posts.length} post(s): ${posts.map((p) => p.slug).join(", ")}`
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(`send-digest failed: ${err.message}`);
    process.exit(1);
  });
