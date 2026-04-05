import "@/lib/clerk-env";
import { auth } from "@clerk/nextjs/server";
import { isClerkEnabled } from "@/lib/clerk";

export async function requireProtectedAccess() {
  const clerkEnabled = isClerkEnabled();

  if (!clerkEnabled) {
    return { ok: true, authDisabled: true };
  }

  const { userId } = await auth();
  if (!userId) {
    return { ok: false, response: Response.json({ ok: false, error: "Unauthorized" }, { status: 401 }) };
  }

  return { ok: true, userId };
}
