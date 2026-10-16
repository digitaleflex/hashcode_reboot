import { redirect } from "next/navigation";

/**
 * /admin/login DÉPRÉCIÉ — redirecteur vers le login membre unique (/login).
 *
 * Conservé pour ne pas casser les bookmarks et les ~20 liens clients qui
 * pointent encore vers /admin/login : ils atterrissent ici puis repartent
 * vers /login avec le même `next`. Le formulaire nominatif email+mot de
 * passe (AdminUser) est supprimé — source unique : session membre OTP +
 * Member.adminRole.
 */
export default async function AdminLoginDeprecatedPage({
  searchParams,
}: {
  searchParams?: Promise<{ next?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const next = params.next || "/admin";
  redirect(`/login?next=${encodeURIComponent(next)}`);
}
