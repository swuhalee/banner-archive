import type { NextConfig } from "next";

function getHostnameFromUrl(rawUrl: string | undefined): string | null {
  if (!rawUrl) return null;
  try {
    return new URL(rawUrl).hostname;
  } catch {
    return null;
  }
}

const SUPABASE_URL_ENV_KEYS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_URL",
] as const;

const imageHostnames = new Set<string>();
for (const key of SUPABASE_URL_ENV_KEYS) {
  const hostname = getHostnameFromUrl(process.env[key]);
  if (hostname) imageHostnames.add(hostname);
}

const nextConfig: NextConfig = {
  // 상위 디렉터리에 lockfile이 있으면 Next가 워크스페이스 루트를 그쪽으로
  // 추론해 tailwindcss 같은 의존성 해석에 실패한다. 루트를 이 프로젝트로 고정한다.
  turbopack: {
    root: __dirname,
  },
  images: {
    remotePatterns: Array.from(imageHostnames).map((hostname) => ({
      protocol: "https",
      hostname,
    })),
  },
  experimental: {
    serverActions: {
      // Upload form payload can exceed the default 1MB limit.
      bodySizeLimit: "30mb",
    },
  },
};

export default nextConfig;
