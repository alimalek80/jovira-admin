import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "192.168.1.16",
    "192.168.1.26",
    "192.168.1.30",
    "192.168.1.187",
    "172.29.224.1",
  ],
};

export default nextConfig;