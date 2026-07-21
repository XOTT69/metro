import type { ReactNode, SVGProps } from 'react'

export type IconName =
  | 'route'
  | 'map'
  | 'star'
  | 'search'
  | 'swap'
  | 'location'
  | 'clock'
  | 'chevron'
  | 'close'
  | 'sun'
  | 'moon'
  | 'system'
  | 'share'
  | 'info'
  | 'train'
  | 'accessibility'
  | 'offline'
  | 'install'
  | 'arrow'
  | 'check'
  | 'refresh'

const paths: Record<IconName, ReactNode> = {
  route: <><circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><path d="M8 18h3a4 4 0 0 0 4-4v-4a4 4 0 0 1 4-4"/></>,
  map: <><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3z"/><path d="M9 3v15M15 6v15"/></>,
  star: <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9z"/>,
  search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
  swap: <><path d="M7 7h11l-3-3M17 17H6l3 3"/><path d="M18 7 15 4M6 17l3 3"/></>,
  location: <><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></>,
  clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  chevron: <path d="m9 18 6-6-6-6"/>,
  close: <path d="M6 6l12 12M18 6 6 18"/>,
  sun: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.66 6.34l1.41-1.41"/></>,
  moon: <path d="M20 15.5A8.5 8.5 0 0 1 8.5 4 8.5 8.5 0 1 0 20 15.5Z"/>,
  system: <><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/></>,
  share: <><circle cx="18" cy="5" r="2"/><circle cx="6" cy="12" r="2"/><circle cx="18" cy="19" r="2"/><path d="m8 11 8-5M8 13l8 5"/></>,
  info: <><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/></>,
  train: <><rect x="5" y="3" width="14" height="15" rx="4"/><path d="M8 21l2-3M16 21l-2-3M8 8h8M8 13h.01M16 13h.01"/></>,
  accessibility: <><circle cx="12" cy="4" r="2"/><path d="M10 22a7 7 0 1 1 7-7M12 6v6h5l3 5M8 10h7"/></>,
  offline: <><path d="M5 12a7 7 0 0 1 11.8-5M3 3l18 18M8.5 16a5 5 0 0 1 7-1M12 20h.01"/></>,
  install: <><path d="M12 3v11M8 10l4 4 4-4"/><path d="M5 17v3h14v-3"/></>,
  arrow: <path d="M5 12h14M13 6l6 6-6 6"/>,
  check: <path d="m5 12 4 4L19 6"/>,
  refresh: <><path d="M20 6v5h-5"/><path d="M4 18v-5h5"/><path d="M18.5 9A7 7 0 0 0 6 6.5L4 9M5.5 15A7 7 0 0 0 18 17.5L20 15"/></>,
}

export const Icon = ({ name, size = 22, ...props }: SVGProps<SVGSVGElement> & { name: IconName; size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.9"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    {...props}
  >
    {paths[name]}
  </svg>
)
