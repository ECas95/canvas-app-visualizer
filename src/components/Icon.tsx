import type { ReactNode, SVGProps } from "react";

export type IconName =
  | "open"
  | "search"
  | "shield"
  | "code"
  | "screen"
  | "component"
  | "local"
  | "diagnostics"
  | "properties"
  | "chevron";

interface Props extends SVGProps<SVGSVGElement> {
  name: IconName;
  size?: number;
}

export function Icon({ name, size = 16, ...props }: Props) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true
  };

  const paths: Record<IconName, ReactNode> = {
    open: (
      <>
        <path d="M3.5 7.5h6l1.6 2h9.4v8.8a2.2 2.2 0 0 1-2.2 2.2H5.7a2.2 2.2 0 0 1-2.2-2.2Z" />
        <path d="M3.5 9.5V5.7a2.2 2.2 0 0 1 2.2-2.2h4.1l1.8 2h6.7" />
      </>
    ),
    search: (
      <>
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m15.5 15.5 4 4" />
      </>
    ),
    shield: (
      <>
        <path d="M12 3.5 19 6v5.3c0 4.3-2.8 7.7-7 9.2-4.2-1.5-7-4.9-7-9.2V6Z" />
        <path d="m9 12 2 2 4-4" />
      </>
    ),
    code: (
      <>
        <path d="m8.5 7-5 5 5 5" />
        <path d="m15.5 7 5 5-5 5" />
        <path d="m13.5 4-3 16" />
      </>
    ),
    screen: (
      <>
        <rect x="3" y="4" width="18" height="14" rx="2" />
        <path d="M8 21h8" />
        <path d="M12 18v3" />
      </>
    ),
    component: (
      <>
        <rect x="4" y="4" width="6" height="6" rx="1.2" />
        <rect x="14" y="4" width="6" height="6" rx="1.2" />
        <rect x="4" y="14" width="6" height="6" rx="1.2" />
        <rect x="14" y="14" width="6" height="6" rx="1.2" />
      </>
    ),
    local: (
      <>
        <rect x="3.5" y="4" width="17" height="12" rx="2" />
        <path d="M8 20h8" />
        <path d="M12 16v4" />
        <path d="m8.5 10 2.3 2.3 4.7-4.7" />
      </>
    ),
    diagnostics: (
      <>
        <path d="M12 3 3.8 19h16.4Z" />
        <path d="M12 9v4" />
        <path d="M12 16.5h.01" />
      </>
    ),
    properties: (
      <>
        <path d="M5 6h14" />
        <path d="M5 12h14" />
        <path d="M5 18h14" />
        <circle cx="9" cy="6" r="1.5" fill="currentColor" stroke="none" />
        <circle cx="15" cy="12" r="1.5" fill="currentColor" stroke="none" />
        <circle cx="11" cy="18" r="1.5" fill="currentColor" stroke="none" />
      </>
    ),
    chevron: <path d="m9 6 6 6-6 6" />
  };

  return (
    <svg {...common} {...props}>
      {paths[name]}
    </svg>
  );
}
