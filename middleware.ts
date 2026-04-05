import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { getClerkPublishableKey, getClerkSecretKey, isClerkEnabled } from "@/lib/clerk";

const isProtectedRoute = createRouteMatcher(["/dashboard(.*)", "/api(.*)"]);
const publishableKey = getClerkPublishableKey();
const secretKey = getClerkSecretKey();

const withClerk = clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    await auth.protect();
  }
}, {
  publishableKey,
  secretKey
});

export default isClerkEnabled() ? withClerk : () => NextResponse.next();

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)"
  ]
};
