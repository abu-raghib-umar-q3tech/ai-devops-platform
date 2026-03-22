import { useId } from "react";

export const APP_BRAND_NAME = "AI DevOps Platform";

export const APP_BRAND_TAGLINE = "Logs, code issues & AI-assisted fixes";

type AppBrandLogoProps = {
  className?: string;
};

/** Log lines + prompt + insight node — matches public/favicon.svg */
export function AppBrandLogo({ className = "h-10 w-10" }: Readonly<AppBrandLogoProps>) {
  const rawId = useId().replaceAll(":", "");
  const gradientId = `brand-grad-${rawId}`;

  return (
    <svg
      className={className}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <defs>
        <linearGradient
          id={gradientId}
          x1="4"
          y1="2"
          x2="28"
          y2="30"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#6366f1" />
          <stop offset="1" stopColor="#4338ca" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill={`url(#${gradientId})`} />
      <path fill="#22d3ee" d="M8 11.5 11.5 14 8 16.5z" />
      <rect
        x="12.5"
        y="10"
        width="13"
        height="2.25"
        rx="1"
        fill="#c7d2fe"
        opacity=".95"
      />
      <rect
        x="12.5"
        y="14.9"
        width="10"
        height="2.25"
        rx="1"
        fill="#a5b4fc"
        opacity=".85"
      />
      <rect
        x="12.5"
        y="19.8"
        width="12"
        height="2.25"
        rx="1"
        fill="#a5b4fc"
        opacity=".75"
      />
      <circle cx="25" cy="7" r="3.25" fill="#22d3ee" />
      <circle cx="25" cy="7" r="1.35" fill="#312e81" />
    </svg>
  );
}

type AppBrandTitleProps = {
  /** Larger heading on dashboard / admin */
  variant?: "page" | "auth";
};

export function AppBrandTitle({ variant = "page" }: Readonly<AppBrandTitleProps>) {
  const subtitle = (
    <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
      {APP_BRAND_TAGLINE}
    </p>
  );

  if (variant === "auth") {
    return (
      <div className="min-w-0">
        <p className="text-base font-semibold tracking-tight text-slate-900 dark:text-slate-50">
          {APP_BRAND_NAME}
        </p>
      </div>
    );
  }

  return (
    <div className="min-w-0">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
        {APP_BRAND_NAME}
      </h1>
      {subtitle}
    </div>
  );
}

type AppBrandLockupProps = {
  variant?: "page" | "auth";
  className?: string;
};

export function AppBrandLockup({
  variant = "page",
  className = "",
}: Readonly<AppBrandLockupProps>) {
  const logoSize = variant === "page" ? "h-10 w-10 shrink-0" : "h-11 w-11 shrink-0";
  return (
    <div className={`flex items-center gap-3 md:gap-4 ${className}`}>
      <AppBrandLogo className={logoSize} />
      <AppBrandTitle variant={variant} />
    </div>
  );
}

/** Admin page: product strip + screen title as single h1 */
export function AppBrandAdminHeading() {
  return (
    <div className="flex items-center gap-3">
      <AppBrandLogo className="h-9 w-9 shrink-0" />
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {APP_BRAND_NAME}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
          Admin Dashboard
        </h1>
      </div>
    </div>
  );
}
