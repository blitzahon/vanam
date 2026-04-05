import { auth } from "@clerk/nextjs/server";

import { getClerkConfigurationIssue, isClerkEnabled, isClerkProtectionReady } from "@/lib/clerk";

export async function requireProtectedAccess() {
  const configurationIssue = getClerkConfigurationIssue();

  if (configurationIssue) {
    return {
      ok: false,
      response: Response.json(
        {
          ok: false,
          error: configurationIssue,
          code: "clerk-configuration-invalid"
        },
        { status: 503 }
      )
    };
  }

  if (!isClerkEnabled()) {
    return { ok: true };
  }

  if (!isClerkProtectionReady()) {
    return {
      ok: false,
      response: Response.json(
        {
          ok: false,
          error: "Protected access is not available in this environment yet.",
          code: "clerk-protection-unavailable"
        },
        { status: 503 }
      )
    };
  }

  const session = await auth();

  if (!session.userId) {
    return {
      ok: false,
      response: Response.json(
        {
          ok: false,
          error: "You must sign in before using this route.",
          code: "auth-required"
        },
        { status: 401 }
      )
    };
  }

  return { ok: true, userId: session.userId };
}
