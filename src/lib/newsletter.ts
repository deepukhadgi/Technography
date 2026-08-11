/**
 * Newsletter — Listmonk campaign fetcher.
 *
 * Server-side helper only. Credentials come from env vars and are never
 * logged or exposed to the client.
 */

type ListmonkCampaign = {
  id: number;
  name: string;
  subject: string;
  created_at: string;
  status: string;
  sent: number;
};

type ListmonkResponse = {
  data: ListmonkCampaign[];
};

export interface Campaign {
  id: number;
  title: string;
  date: string;
  sent: number;
  archiveUrl: string;
}

/** Format an ISO date to a human-readable string. */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Fetch finished campaigns from the Listmonk API.
 *
 * Uses `status=finished` and `limit=12` per the archive spec.
 * Returns campaigns sorted newest-first.
 */
export async function fetchCampaigns(): Promise<Campaign[]> {
  const listmonkUrl = process.env.LISTMONK_URL;
  const listmonkUser = process.env.LISTMONK_USER;
  const listmonkToken = process.env.LISTMONK_TOKEN;

  if (!listmonkUrl || !listmonkUser || !listmonkToken) {
    throw new Error("Listmonk not configured");
  }

  const base = listmonkUrl.replace(/\/+$/, "");
  const url = `${base}/api/campaigns?limit=12&status=finished`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Basic ${Buffer.from(
        `${listmonkUser}:${listmonkToken}`
      ).toString("base64")}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Listmonk API error: ${res.status}`);
  }

  const json = (await res.json()) as ListmonkResponse;
  const campaigns: ListmonkCampaign[] = Array.isArray(json.data)
    ? json.data
    : [];

  return campaigns
    .sort((a, b) => (b.created_at < a.created_at ? -1 : b.created_at > a.created_at ? 1 : 0))
    .map((c) => ({
      id: c.id,
      title: c.subject || c.name || `Campaign #${c.id}`,
      date: formatDate(c.created_at),
      sent: c.sent ?? 0,
      archiveUrl: `${base}/archive/${c.id}`,
    }));
}
