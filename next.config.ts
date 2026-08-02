import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Voice memo uploads for journal transcription; matches Whisper's own cap.
      bodySizeLimit: "25mb",
    },
  },
};

export default nextConfig;
