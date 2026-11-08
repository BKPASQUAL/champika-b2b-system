/** @type {import('next').NextConfig} */
// NOTE: Next.js loads this file before next.config.ts, so THIS is the active config.
const nextConfig = {
  images: {
    // Product / banner images stored in Supabase Storage (online shop).
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/public/**" },
    ],
  },
};

export default nextConfig;
