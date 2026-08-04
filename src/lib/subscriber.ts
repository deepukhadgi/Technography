import { getSession } from "@/lib/auth";

/**
 * Central "is this user a subscriber?" check.
 *
 * For now a subscriber is any email-verified, logged-in user (login already
 * enforces email_verified=true). When a paid tier / role / plan lands, change
 * THIS ONE function (e.g. look up a subscription or plan for session.userId)
 * and every gated page picks it up automatically.
 */
export async function isSubscriber(): Promise<boolean> {
  const session = await getSession();
  return session !== null;
}
