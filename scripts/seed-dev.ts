/**
 * Local dev seed — creates/ensures admin + sub-admin accounts.
 * Run: bun scripts/seed-dev.ts
 */
import { db } from "@aloysius-admissions/db";
import { auth, ensureSiteAdmin, ensureSubAdmins } from "@aloysius-admissions/api/server";

console.log("Seeding admin accounts…");
await ensureSiteAdmin(db, auth);
await ensureSubAdmins(db, auth);
console.log("\nDone. Credentials:");
console.log("  admin:     admin@aloysiuscollege.lk");
console.log("  password:  ADMIN_PASSWORD =", process.env.ADMIN_PASSWORD ?? "(not set)");
console.log("  sub-admin: subadmin@aloysiuscollege.lk");
console.log("  password:  SUB_ADMIN_PASSWORD =", process.env.SUB_ADMIN_PASSWORD ?? "(not set)");
console.log("\n  Login at: http://localhost:3001/auth/sign-in");
