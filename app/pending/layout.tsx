import { ProtectedShell } from "@/components/auth/RouteGuard";

export default function PendingLayout({ children }: LayoutProps<"/pending">) {
  return <ProtectedShell area="pending">{children}</ProtectedShell>;
}
