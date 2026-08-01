# Technography

Personal website and tech blog of **Deepu Khadgi** (DevOps Engineer).

Live at [deepukhadgi.com.np](https://deepukhadgi.com.np).

## Stack

- [Next.js](https://nextjs.org) (App Router, standalone output) + TypeScript
- Tailwind CSS v4
- Markdown blog posts in `content/posts/` (frontmatter: `title`, `date`, `excerpt`, `tags`)
- Deployed self-hosted: Node.js + nginx reverse proxy

## Structure

```
src/app/          pages (home, about, blog, contact)
src/lib/posts.ts  markdown → HTML blog engine
content/posts/    blog posts (add a .md file → it appears on the blog)
```

## Local development

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build (.next/standalone)
```

## Writing a post

Create `content/posts/my-post.md`:

```md
---
title: "My post"
date: "2026-08-01"
excerpt: "Short summary shown on the blog index."
tags: ["linux", "docker"]
---

Content in markdown...
```

Done — it shows up on `/blog` after a rebuild.

## License

MIT — see [LICENSE](LICENSE).
