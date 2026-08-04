import { getSession } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return Response.json({ loggedIn: false });
  }
  return Response.json({ loggedIn: true, email: session.email, userId: session.userId });
}
