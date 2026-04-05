import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: __dirname,
  outputFileTracingExcludes: {
    "*": [
      "datasets/**",
      "runs/**",
      "videos/**",
      "events/**",
      "Ultralytics/**",
      "database.db",
      "runtime/**"
    ]
  }
};

export default nextConfig;
