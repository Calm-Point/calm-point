import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Portals, auth surfaces, and the screener are not for crawlers.
        disallow: ["/app", "/provider", "/admin", "/api", "/screener", "/crisis", "/mfa"],
      },
    ],
    sitemap: `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://calmpoint.example"}/sitemap.xml`,
  };
}
