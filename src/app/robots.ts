import type { MetadataRoute } from "next";

const BASE = "https://deepukhadgi.com.np";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/login", "/signup", "/forgot-password", "/reset-password"],
    },
    sitemap: `${BASE}/sitemap.xml`,
  };
}