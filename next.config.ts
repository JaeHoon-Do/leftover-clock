import type { NextConfig } from "next";

// Every screen reads IndexedDB on the phone, so nothing is prerendered with data;
// Cache Components would only add Suspense boundaries around useParams.
const nextConfig: NextConfig = {};

export default nextConfig;
