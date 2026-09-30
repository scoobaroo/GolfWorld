import type { ReactNode } from 'react';
export type IconName = 'flag' | 'phone' | 'home' | 'map' | 'scores' | 'settings' | 'inventory' | 'friends' | 'shop' | 'close' | 'arrow';
const paths: Record<IconName, ReactNode> = {
  flag: <><path d="M5 21V3m0 0 14 5-14 5" /><path d="M3 21h7" /></>,
  phone: <><rect x="6" y="2" width="12" height="20" rx="3" /><path d="M10 5h4m-3 14h2" /></>,
  home: <><path d="m3 11 9-8 9 8v10H3Z" /><path d="M9 21v-7h6v7" /></>,
  map: <><path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2Zm6-2v16m6-14v16" /></>,
  scores: <><path d="M7 3h10v8a5 5 0 0 1-10 0Zm0 2H3v3a4 4 0 0 0 4 4m10-7h4v3a4 4 0 0 1-4 4M12 16v5m-4 0h8" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="m10 3 4 0 1 3 3 1 3 3v4l-3 1-1 3-3 3h-4l-1-3-3-1-3-3v-4l3-1 1-3Z" /></>,
  inventory: <><path d="m3 7 9-4 9 4v13H3Zm0 0 9 4 9-4M12 11v9" /></>,
  friends: <><circle cx="9" cy="8" r="3" /><path d="M3 21v-4a6 6 0 0 1 12 0v4m1-16a3 3 0 0 1 0 6m2 3a5 5 0 0 1 3 5v2" /></>,
  shop: <><path d="M4 9h16v12H4ZM3 9l2-6h14l2 6M8 21v-7h8v7" /></>,
  close: <path d="m6 6 12 12M6 18 18 6" />,
  arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
};
export function Icon({ name, size = 22 }: { name: IconName; size?: number }): ReactNode {
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}
