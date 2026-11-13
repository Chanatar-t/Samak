import { desc, eq } from "drizzle-orm";
import { requireUser } from "@/auth";
import { db, applications } from "@/db";
import Board from "./board";

export default async function Home() {
  const userId = await requireUser();
  const apps = await db.select().from(applications).where(eq(applications.userId, userId)).orderBy(desc(applications.lastActivityAt));
  return <Board apps={apps} />;
}
