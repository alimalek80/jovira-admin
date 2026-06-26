import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "192.168.1.*",
    "172.29.*.*",
  ],
};

export default nextConfig;