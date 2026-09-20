import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  reactStrictMode: true,
  /* `next build` and `next dev` both write to .next. Running a build while the
     dev server is up corrupts its state and takes the dev server down - which
     is exactly what kept killing localhost:3111. Builds now use their own
     directory so a verification build can never disturb a running dev server. */
  distDir: process.env.NEXT_DIST_DIR || ".next",
  /* data/search.txt is read with fs at runtime by /api/topic. Nothing imports
     it, so Next would not trace it into the function and every lookup would
     answer 500 on the deployed site while working perfectly in `next dev`. */
  outputFileTracingIncludes: {
    "/api/topic": ["./data/search.txt"],
  },
};
export default nextConfig;
