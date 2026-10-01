import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps } from "react";

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
export type ButtonSize = "md" | "sm";

const BASE =
  "inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-60";

const SIZE: Record<ButtonSize, string> = {
  md: "px-5 text-base font-semibold",
  sm: "px-4 text-sm font-medium",
};

/** Blue always means "do it"; red only for destructive actions; secondary is outlined; ghost has no border. */
const VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-blue-700 text-white hover:bg-blue-800",
  secondary: "border border-line-strong hover:bg-surface",
  danger: "bg-red-700 text-white hover:bg-red-800",
  ghost: "hover:bg-surface",
};

type StyleProps = { variant?: ButtonVariant; size?: ButtonSize; className?: string };

/** The one button look (docs/UX_REVIEW.md UX-16). Every button is at least 44 px tall. */
export function buttonClasses({ variant = "primary", size = "md", className }: StyleProps = {}): string {
  return [BASE, SIZE[size], VARIANT[variant], className].filter(Boolean).join(" ");
}

type ButtonProps = StyleProps &
  ButtonHTMLAttributes<HTMLButtonElement> & {
    /** While true the button is disabled and shows `busyLabel` (e.g. "Saving…") instead of its children. */
    busy?: boolean;
    busyLabel?: string;
  };

export function Button({ variant, size, className, busy = false, busyLabel, disabled, type = "button", children, ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || busy}
      className={buttonClasses({ variant, size, className })}
      {...rest}
    >
      {busy && busyLabel ? busyLabel : children}
    </button>
  );
}

/** A link that looks like a button, for navigation actions ("Sign in", "New task"). */
export function ButtonLink({ variant, size, className, ...rest }: StyleProps & ComponentProps<typeof Link>) {
  return <Link className={buttonClasses({ variant, size, className })} {...rest} />;
}
