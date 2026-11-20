import { desc, eq } from "drizzle-orm";
import { requireUser } from "@/auth";
import { db, applications } from "@/db";
import List, { type ListParams } from "./list";

export default async function Home({ searchParams }: PageProps<"/">) {
  const userId = await requireUser();
  const apps = await db.select().from(applications).where(eq(applications.userId, userId)).orderBy(desc(applications.lastActivityAt));
  return <List apps={apps} params={(await searchParams) as ListParams} />;
}
