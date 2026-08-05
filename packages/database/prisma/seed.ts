// Seeds real reference data — categories and Indian states/UTs — per
// Section 3's lists. This is NOT sample/fake job data (that would violate
// Section 1 rule 2); it's the fixed taxonomy the rest of the app filters
// and routes on, and the site has no categories/states to filter by
// without it.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

const CATEGORIES = [
  "Central",
  "State",
  "PSU",
  "Bank",
  "Railway",
  "Teaching",
  "Police",
  "Defence",
  "Engineering",
  "IT",
  "Medical",
  "Apprenticeship",
  "Internships",
];

// 28 states + 8 union territories (current as of this schema's authoring;
// this is administrative geography, not something that changes often, but
// worth re-verifying against a current source if this seed is reused far
// in the future).
const STATES: Array<{ name: string; isUnionTerritory: boolean }> = [
  { name: "Andhra Pradesh", isUnionTerritory: false },
  { name: "Arunachal Pradesh", isUnionTerritory: false },
  { name: "Assam", isUnionTerritory: false },
  { name: "Bihar", isUnionTerritory: false },
  { name: "Chhattisgarh", isUnionTerritory: false },
  { name: "Goa", isUnionTerritory: false },
  { name: "Gujarat", isUnionTerritory: false },
  { name: "Haryana", isUnionTerritory: false },
  { name: "Himachal Pradesh", isUnionTerritory: false },
  { name: "Jharkhand", isUnionTerritory: false },
  { name: "Karnataka", isUnionTerritory: false },
  { name: "Kerala", isUnionTerritory: false },
  { name: "Madhya Pradesh", isUnionTerritory: false },
  { name: "Maharashtra", isUnionTerritory: false },
  { name: "Manipur", isUnionTerritory: false },
  { name: "Meghalaya", isUnionTerritory: false },
  { name: "Mizoram", isUnionTerritory: false },
  { name: "Nagaland", isUnionTerritory: false },
  { name: "Odisha", isUnionTerritory: false },
  { name: "Punjab", isUnionTerritory: false },
  { name: "Rajasthan", isUnionTerritory: false },
  { name: "Sikkim", isUnionTerritory: false },
  { name: "Tamil Nadu", isUnionTerritory: false },
  { name: "Telangana", isUnionTerritory: false },
  { name: "Tripura", isUnionTerritory: false },
  { name: "Uttar Pradesh", isUnionTerritory: false },
  { name: "Uttarakhand", isUnionTerritory: false },
  { name: "West Bengal", isUnionTerritory: false },
  { name: "Andaman and Nicobar Islands", isUnionTerritory: true },
  { name: "Chandigarh", isUnionTerritory: true },
  { name: "Dadra and Nagar Haveli and Daman and Diu", isUnionTerritory: true },
  { name: "Delhi", isUnionTerritory: true },
  { name: "Jammu and Kashmir", isUnionTerritory: true },
  { name: "Ladakh", isUnionTerritory: true },
  { name: "Lakshadweep", isUnionTerritory: true },
  { name: "Puducherry", isUnionTerritory: true },
  // Not a state/UT, but jobs frequently apply nationwide — modeled as a
  // State row so it composes with the same JobState filtering/indexing
  // rather than needing a special-cased "all states" branch everywhere.
  { name: "All India", isUnionTerritory: false },
];

async function main() {
  for (const name of CATEGORIES) {
    await prisma.category.upsert({
      where: { name },
      update: {},
      create: { name, slug: slugify(name) },
    });
  }
  console.log(`Seeded ${CATEGORIES.length} categories.`);

  for (const s of STATES) {
    await prisma.state.upsert({
      where: { name: s.name },
      update: {},
      create: { name: s.name, slug: slugify(s.name), isUnionTerritory: s.isUnionTerritory },
    });
  }
  console.log(`Seeded ${STATES.length} states/UTs.`);

  // Section 7/9: one config row per platform, seeded as disabled with
  // the real required-env-var names — matches the platform/adapter
  // pairing in packages/notifications. Nothing here is "fake data" per
  // Section 1 rule 2: `enabled: false` is the accurate starting state
  // (nothing is configured yet), not a placeholder pretending to be
  // real status.
  const PROVIDER_CONFIGS: Array<{ platform: string; requiredEnvVars: string[] }> = [
    { platform: "TELEGRAM", requiredEnvVars: ["TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID"] },
    { platform: "FACEBOOK", requiredEnvVars: ["FACEBOOK_PAGE_ID", "FACEBOOK_PAGE_ACCESS_TOKEN"] },
    { platform: "INSTAGRAM", requiredEnvVars: ["INSTAGRAM_BUSINESS_ACCOUNT_ID", "INSTAGRAM_ACCESS_TOKEN"] },
    { platform: "LINKEDIN", requiredEnvVars: ["LINKEDIN_ORGANIZATION_URN", "LINKEDIN_ACCESS_TOKEN"] },
    {
      platform: "WHATSAPP",
      requiredEnvVars: [
        "WHATSAPP_PHONE_NUMBER_ID",
        "WHATSAPP_ACCESS_TOKEN",
        "WHATSAPP_CHANNEL_ID",
        "WHATSAPP_TEMPLATE_NAME",
      ],
    },
    { platform: "EMAIL", requiredEnvVars: ["EMAIL_API_KEY", "EMAIL_FROM_ADDRESS"] },
    { platform: "PUSH", requiredEnvVars: ["FCM_PROJECT_ID", "FCM_SERVER_KEY"] },
    { platform: "TWITTER", requiredEnvVars: ["TWITTER_USER_ACCESS_TOKEN"] },
  ];

  for (const config of PROVIDER_CONFIGS) {
    await prisma.notificationProviderConfig.upsert({
      where: { platform: config.platform as any },
      update: {},
      create: {
        platform: config.platform as any,
        enabled: false,
        requiredEnvVars: config.requiredEnvVars,
      },
    });
  }
  console.log(`Seeded ${PROVIDER_CONFIGS.length} notification provider configs (all disabled).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
