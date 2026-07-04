import type { MetadataRoute } from "next";
import { CONDITIONS } from "@calm-point/shared";

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://calmpoint.example";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: BASE, changeFrequency: "weekly", priority: 1 },
    { url: `${BASE}/how-it-works`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE}/pricing`, changeFrequency: "monthly", priority: 0.7 },
    ...CONDITIONS.map((c) => ({
      url: `${BASE}/${c.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.9,
    })),
    ...["privacy", "terms", "telehealth-consent", "hipaa-npp"].map((doc) => ({
      url: `${BASE}/legal/${doc}`,
      changeFrequency: "yearly" as const,
      priority: 0.2,
    })),
  ];
}
