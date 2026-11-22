import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { cn } from "./cn.ts";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-1.5 py-px font-mono text-[10px]",
  {
    variants: {
      tone: {
        neutral: "bg-code text-muted",
        waiting: "bg-wait-soft text-wait",
        failed: "bg-del-bg text-del-fg",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

type BadgeProps = HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>;

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
