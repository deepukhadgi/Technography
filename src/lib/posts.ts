import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { remark } from "remark";
import html from "remark-html";

const postsDirectory = path.join(process.cwd(), "content", "posts");

export type PostMeta = {
  slug: string;
  title: string;
  date: string;
  excerpt: string;
  tags: string[];
  /** Subscriber-only post — full content gated behind a logged-in verified account. */
  premium: boolean;
};

export type Post = PostMeta & {
  contentHtml: string;
};

function parseFile(slug: string): { meta: PostMeta; content: string } {
  const fullPath = path.join(postsDirectory, `${slug}.md`);
  const fileContents = fs.readFileSync(fullPath, "utf8");
  const { data, content } = matter(fileContents);

  return {
    meta: {
      slug,
      title: data.title ?? slug,
      date: data.date ? String(data.date) : "1970-01-01",
      excerpt: data.excerpt ?? "",
      tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
      premium: data.premium === true,
    },
    content,
  };
}

export function getAllPosts(): PostMeta[] {
  const files = fs.readdirSync(postsDirectory).filter((f) => f.endsWith(".md"));
  return files
    .map((f) => parseFile(f.replace(/\.md$/, "")).meta)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

export async function getPostBySlug(slug: string): Promise<Post> {
  const { meta, content } = parseFile(slug);
  const processed = await remark().use(html).process(content);
  return {
    ...meta,
    contentHtml: processed.toString(),
  };
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
