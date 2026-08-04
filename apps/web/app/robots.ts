import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/search"], // thin/duplicate query-string pages, matches search/page.tsx's noindex
      },
    ],
    sitemap: [`${SITE_URL}/sitemap.xml`, `${SITE_URL}/news-sitemap.xml`],
  };
}
