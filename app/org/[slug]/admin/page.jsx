/**
 * /org/[slug]/admin — DEPRECATED & SECURED
 * Consolidated into /dashboard (authenticated Org Admin Dashboard).
 * Any direct access here redirects to /dashboard.
 */
import { redirect } from 'next/navigation';

export default function OrgAdminRedirectPage() {
  redirect('/dashboard');
}
