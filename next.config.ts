import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "192.168.1.*",
    "172.29.*.*",
    "172.25.*.*",
    "172.*.*.*",
  ],
};

export default nextConfig;