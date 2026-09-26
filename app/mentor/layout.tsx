import { ProtectedShell } from "@/components/auth/RouteGuard";

export default function MentorLayout({ children }: LayoutProps<"/mentor">) {
  return <ProtectedShell area="mentor">{children}</ProtectedShell>;
}
