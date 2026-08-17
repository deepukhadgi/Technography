---
title: "Meilisearch Tuning: Ranking, Synonyms & Typo Tolerance That Convert"
date: "2026-08-17"
excerpt: "A deep dive into making Meilisearch actually find what you meant: ranked searchable fields, synonym arrays, fine-tuning typo tolerance, ranking rules, and the exact settings that turned sloppy queries into the right result."
tags: ["search", "meilisearch", "performance", "subscriber-only"]
premium: true
---

Search is the feature nobody notices until it's wrong. This blog's search
box runs on Meilisearch, and out of the box it's genuinely good — then you
search the way real people do and it gets frustrating: typos, words that
don't match the field anyone cares about, and results ordered by recency
rather than by *what actually matches*.

Everything below is what I tuned, with the exact settings and the reasoning
behind each one. It's a subscriber deep dive because the "right" values are
specific to this content — search tuning is a conversation with your own
data, not a check-the-boxes recipe.

## The baseline: what Meilisearch gives you free

Meilisearch ships with typo tolerance, prefix search, and sub-word matching
with zero configuration. A query for `depoy` against a document containing
"deploy" matches within a keystroke. That is genuinely clever — and it is
wrong more often than you'd expect, because the defaults know nothing about
your *domain*: that two words are related, or that one field should
outrank another.

The knobs live in a small set of per-index settings:
`searchableAttributes`, `filterableAttributes`, `rankingRules`, `synonyms`,
and `typoTolerance`. Because they are per-index, you can shape search before
you index a single document.

## Step 1: Curate `searchableAttributes`

Out of the box Meilisearch treats every field equally. That is the core
problem. A post body might mention "deploy" twenty times; its title carries
the word once. Default ranking weights fields by their order in the
document — effectively random from a UX point of view. Tuning starts with
telling Meilisearch which fields your readers actually mean.

`searchableAttributes` is a priority-ordered list: the first entry ranks
highest. For a blog you want title to beat tags to beat body:

```json
["title", "tags", "excerpt", "body"]
```

Now a query for `deploy` matches the post whose *title* contains "deploy"
before anything that merely mentions it in a paragraph. Rank order is
intent; get it wrong and the box feels like it is lying to you.

`filterableAttributes` matters only if you allow narrowing in the UI. I keep
tags filterable so a reader can query `tags:nextjs`, but the click-through
default ranking stays purely over the searchable fields.

## Step 2: Typo tolerance — forgiveness with a guardrail

Meilisearch's typo engine lets a word differ by one or two characters.
That widens the candidate set, and on a small index it can make "docker"
and "doctor" compete for the same results. The high-leverage knob is
`minWordSizeForTypos`:

```json
{
  "enabled": true,
  "minWordSizeForTypos": {
    "oneTypo": 4,
    "twoTypos": 8
  }
}
```

The rule: a three-letter word must match exactly; single-typo forgiveness
only applies to words of four letters or more; double-typo forgiveness
starts at eight. Short queries — `npm`, `ssh`, `vpn` — have to be nearly
exact, which is exactly what you want when the search box is usually one
or two words long.

The result: fewer bogus matches and the results you do get line up with
what the user actually typed. This is the single biggest reduction in
"useless results" I measured.

## Step 3: Ranking rules — the hidden order of decisions

Ranking in Meilisearch lives in `rankingRules`, a list evaluated in order;
each rule only breaks the tie left by the previous one. The default is:

```json
["words", "typo", "proximity", "attribute", "sort", "exactness"]
```

So: most matched words first, then fewest typos, then shortest distance
between matched terms, then attribute priority, then exactness. That is a
sane default for a broad catalog.

For a nav-style blog the sleeper hit is **`attribute`**. It weights the
priority order you set in `searchableAttributes` — but only as a
tiebreaker *after* proximity. I moved it up one slot:

```json
["words", "typo", "attribute", "proximity", "sort", "exactness"]
```

Now a word in the title wins over a word found closer together in the body.
For this site, where the reader is usually hunting for a specific post
rather than a phrase buried in a paragraph, that ordering is far closer to
what they expect.

## Step 4: Synonyms — the cheat code

Here is the thing nobody tells you: ranking and typo settings are
mechanics, but **synonyms are the domain**. Out of the box a query for
`setup` does *not* match a post about "installing" even if that is exactly
what the post is about. No ranking rule can fix a plain vocabulary mismatch.

Synonyms are a map where each key groups a set of interchangeable terms:

```json
{
  "setup": ["install", "configuration", "configure", "deploy"],
  "vpn": ["wireguard", "tunnel", "remote-access"],
  "search": ["meilisearch", "full-text", "typo", "indexing"]
}
```

Two things make this powerful:

1. **Synonyms commute within an array.** A document that says "configure"
   will now surface for a `setup` query, and vice versa. Each group forms a
   cluster of equal concepts.
2. **Meilisearch expands both sides.** It considers synonymous terms on the
   query and on the document, so partial conceptual matches turn into full
   hits.

The highest-leverage synonyms are the ones mapping people's mental
vocabulary to your actual titles: `monitoring` with `grafana, dashboard,
alerts`, `mail` with `email, smtp, newsletter, deliverability`. The ten
minutes you spend deciding that list are the ten minutes that matter most.

## Step 5: Combined, the effect is "knowing enough"

Try the word `reqt` (a torn-up "request"). With `minWordSizeForTypos`, the
five-character word allows a single typo. Meilisearch explores `requt`,
`reque`, `requ*`, and a prefix match lands on `requirement`. Add a synonym
so "request" behaves like a term your content uses — and the right entry
lands near the top. Together those features feel like understanding, but
it's just two config settings doing predictable work.

## A pipeline you can rebuild deterministically

Keep every index setting in source control, next to the content it shapes.
A typical reindex script:

```node
const index = client.index("posts");
await index.updateSearchableAttributes(["title", "tags", "excerpt", "body"]);
await index.updateRankingRules(["words", "typo", "attribute", "proximity", "sort", "exactness"]);
await index.updateTypoTolerance({ enabled: true, minWordSizeForTypos: { oneTypo: 4, twoTypos: 8 } });
await index.updateSynonyms(synonymMap);
await index.addDocuments(docs, { primaryKey: "id" });
```

Each `update*` is asynchronous; applying the whole set on every deploy
means your search config evolves with your code, and a stray setting change
cannot silently break search while everything else looks healthy.

## What actually moved the needle

I recorded impressions-per-query before and after tuning:

- Tightening `minWordSizeForTypos` removed most single-character noise —
  queries that "matched" by a lucky letter change now correctly return
  nothing, or the real target.
- Moving `attribute` above `proximity` made title matches reliable, which
  pushed far more clicks onto the top result.
- The synonym clusters were the biggest gain of all: the everyday synonyms
  that nobody trains you to think about — verbs, nouns, colloquial names—turned
  "one result or a dead end" into "here is exactly that article."

## The takeaway

Search is not magic — it is metadata about your data. The defaults are
decent but generic. Add a little contact:

1. **Rank by meaning, not by accident** — curate `searchableAttributes`
   with your intent first.
2. **Let close words behave like the same word** — a short synonym map.
3. **Forgive typos only where it is plausible** — 4/8 word-length gates.

With those three in place, a one-post blog and a fifty-thousand-document
catalog both get a box that feels like it *knows* what is in them. The only
noise left is the quality of your writing itself — and that is the fun kind
of problem.