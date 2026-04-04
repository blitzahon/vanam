import { auth } from "@clerk/nextjs/server";

export async function requireProtectedAccess() {
  const clerkEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY);

  if (!clerkEnabled) {
    return { ok: true, authDisabled: true };
  }

  const { userId } = await auth();
  if (!userId) {
    return { ok: false, response: Response.json({ ok: false, error: "Unauthorized" }, { status: 401 }) };
  }

  return { ok: true, userId };
}
