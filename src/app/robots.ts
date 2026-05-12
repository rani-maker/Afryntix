import type { MetadataRoute } from "next";

const APP_URL = "https://www.afryntix.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/tracking", "/services", "/addresses"],
        disallow: ["/dashboard", "/staff", "/admin", "/api", "/login", "/register"],
      },
    ],
    sitemap: `${APP_URL}/sitemap.xml`,
  };
}
