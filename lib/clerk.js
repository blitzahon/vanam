const defaultSignInUrl = "/";
const defaultSignUpUrl = "/sign-up";

export function getClerkPublishableKey() {
  return process.env.NEXT_PUBLIC_AUTHENTICATION_CLERK_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || "";
}

export function getClerkSecretKey() {
  return process.env.AUTHENTICATION_CLERK_SECRET_KEY || process.env.CLERK_SECRET_KEY || "";
}

export function getClerkConfigurationIssue() {
  const publishableKey = getClerkPublishableKey();
  const secretKey = getClerkSecretKey();

  if (!publishableKey || !secretKey) {
    return "";
  }

  if (process.env.VERCEL && (publishableKey.startsWith("pk_test_") || secretKey.startsWith("sk_test_"))) {
    return "This production deployment is still using Clerk test keys. Replace them with production Clerk keys before expecting live employee sign-in to work on the Vercel domain.";
  }

  return "";
}

export function isClerkEnabled() {
  return Boolean(getClerkPublishableKey() && getClerkSecretKey());
}

export function getClerkSignInUrl() {
  return process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL || defaultSignInUrl;
}

export function getClerkSignUpUrl() {
  return process.env.NEXT_PUBLIC_CLERK_SIGN_UP_URL || defaultSignUpUrl;
}
