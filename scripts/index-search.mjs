#!/usr/bin/env node
/**
 * Index all markdown posts into Meilisearch.
 * Run after each deploy: node scripts/index-search.mjs
 */
import fs from "fs";
import path from "path";
import matter from "gray-matter";

const MEILI_HOST = process.env.MEILI_HOST ?? (() => { throw new Error("MEILI_HOST must be set in .env.local — never use the default fallback"); })();
const MEILI_MASTER_KEY = process.env.MEILI_MASTER_KEY ?? (() => { throw new Error("MEILI_MASTER_KEY must be set in .env.local — never use the default fallback"); })();

if (!MEILI_MASTER_KEY) {
  console.error("MEILI_MASTER_KEY not set — aborting");
  process.exit(1);
}

const postsDir = path.join(process.cwd(), "content", "posts");
const files = fs.readdirSync(postsDir).filter((f) => f.endsWith(".md"));

const documents = files.map((f) => {
  const slug = f.replace(/\.md$/, "");
  const { data } = matter(fs.readFileSync(path.join(postsDir, f), "utf8"));
  return {
    slug,
    title: data.title ?? slug,
    excerpt: data.excerpt ?? "",
    date: data.date ? String(data.date) : null,
    tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
    premium: data.premium === true,
  };
});

const res = await fetch(`${MEILI_HOST}/indexes/posts/documents`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${MEILI_MASTER_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(documents),
});

if (!res.ok) {
  console.error(`Indexing failed: HTTP ${res.status} — ${await res.text()}`);
  process.exit(1);
}

const task = await res.json();
console.log(`Indexed ${documents.length} posts (task ${task.taskUid ?? task.uid ?? "?"})`);
