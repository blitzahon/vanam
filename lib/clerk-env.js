const publishableKey =
  process.env.NEXT_PUBLIC_AUTHENTICATION_CLERK_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || "";
const secretKey = process.env.AUTHENTICATION_CLERK_SECRET_KEY || process.env.CLERK_SECRET_KEY || "";

if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && publishableKey) {
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = publishableKey;
}

if (!process.env.CLERK_SECRET_KEY && secretKey) {
  process.env.CLERK_SECRET_KEY = secretKey;
}

export function getConfiguredClerkPublishableKey() {
  return publishableKey;
}

export function getConfiguredClerkSecretKey() {
  return secretKey;
}
