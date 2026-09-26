import { ProtectedShell } from "@/components/auth/RouteGuard";

export default function StudentLayout({ children }: LayoutProps<"/student">) {
  return <ProtectedShell area="student">{children}</ProtectedShell>;
}
