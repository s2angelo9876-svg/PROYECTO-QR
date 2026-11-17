import { getCurrentUser } from "@/lib/auth";
import { databaseConfigured, inSchool } from "@/lib/db";
import AdminShell from "@/components/admin/AdminShell";
export const dynamic = "force-dynamic";
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser().catch(() => null);
  const school = user?.schoolId
    ? await inSchool(
        user.schoolId,
        async (c) => (await c.query("SELECT name FROM schools")).rows[0]?.name,
      ).catch(() => null)
    : null;
  return (
    <AdminShell
      user={user}
      schoolName={school || "Colegio de demostración"}
      demo={!databaseConfigured()}
    >
      {children}
    </AdminShell>
  );
}
