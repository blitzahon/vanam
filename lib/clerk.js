const defaultSignInUrl = "/";
const defaultSignUpUrl = "/sign-up";

import { getConfiguredClerkPublishableKey, getConfiguredClerkSecretKey } from "@/lib/clerk-env";

export function getClerkPublishableKey() {
  return getConfiguredClerkPublishableKey();
}

export function getClerkSecretKey() {
  return getConfiguredClerkSecretKey();
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
