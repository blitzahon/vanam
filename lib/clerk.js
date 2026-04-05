const defaultSignInUrl = "/";
const defaultSignUpUrl = "/sign-up";

export function getClerkPublishableKey() {
  return process.env.NEXT_PUBLIC_AUTHENTICATION_CLERK_PUBLISHABLE_KEY || "";
}

export function isClerkEnabled() {
  return Boolean(getClerkPublishableKey() && process.env.CLERK_SECRET_KEY);
}

export function getClerkSignInUrl() {
  return process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL || defaultSignInUrl;
}

export function getClerkSignUpUrl() {
  return process.env.NEXT_PUBLIC_CLERK_SIGN_UP_URL || defaultSignUpUrl;
}
