import { ProtectedShell } from "@/components/auth/RouteGuard";

export default function OnboardingLayout({ children }: LayoutProps<"/onboarding">) {
  return <ProtectedShell area="onboarding">{children}</ProtectedShell>;
}
