import type { ReactNode } from 'react';
export type IconName = 'flag' | 'phone' | 'home' | 'map' | 'scores' | 'settings' | 'inventory' | 'friends' | 'shop' | 'close' | 'arrow' | 'building' | 'office' | 'medical' | 'school' | 'food' | 'landmark' | 'factory' | 'pin';
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
  building: <><rect x="5" y="3" width="14" height="18" rx="1" /><path d="M9 7h1m4 0h1M9 11h1m4 0h1M9 15h1m4 0h1M11 21v-3h2v3" /></>,
  office: <><path d="M4 21V3h12v18m0-10h4v10M2 21h20M8 7h4m-4 4h4m-4 4h4m-3 6v-3h2v3" /></>,
  medical: <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M12 6v6m-3-3h6m-5 12v-5h4v5" /></>,
  school: <><path d="m3 10 9-7 9 7v11H3ZM9 21v-6h6v6M7 11h1m8 0h1" /><circle cx="12" cy="9" r="1" /></>,
  food: <><path d="M5 3v7m3-7v7m3-7v7M5 7h6m-6 3c0 3 6 3 6 0M8 13v8m11-18c-4 2-4 8 0 9V3Zm0 9v9" /></>,
  landmark: <><path d="m3 8 9-5 9 5ZM5 8v10m5-10v10m4-10v10m5-10v10M3 18h18M2 21h20" /></>,
  factory: <><path d="M3 21V10l6 4v-4l6 4V3h4l2 18ZM7 17h1m4 0h1m4 0h1" /></>,
  pin: <><path d="M19 9c0 5-7 12-7 12S5 14 5 9a7 7 0 1 1 14 0Z" /><circle cx="12" cy="9" r="2" /></>,
};
export function Icon({ name, size = 22 }: { name: IconName; size?: number }): ReactNode {
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}
