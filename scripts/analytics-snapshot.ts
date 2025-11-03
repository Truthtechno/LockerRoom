import { storage } from "../server/storage";

async function run() {
  try {
    const overview = await storage.getPlatformAnalyticsOverview("month");
    const users = await storage.getPlatformUserAnalytics("month", "role");
    const schools = await storage.getPlatformSchoolAnalytics("month");
    const revenue = await storage.getPlatformRevenueAnalytics("year");
    const content = await storage.getPlatformContentAnalytics("month");
    const engagement = await storage.getPlatformEngagementAnalytics("month", "day");

    const snapshot = { overview, users, schools, revenue, content, engagement };
    console.log(JSON.stringify(snapshot, null, 2));
  } catch (err) {
    console.error("snapshot-error", err);
    process.exit(1);
  }
}

run();


