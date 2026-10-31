// Line icons drawn on a 24px grid, stroked in currentColor so they take the text colour around them.
const PATHS: Record<string, string> = {
  home: 'M3 10.5 12 3l9 7.5M5 9.5V21h5v-6h4v6h5V9.5',
  store: 'M3 9l1.5-5h15L21 9M3 9h18M3 9c0 1.7 1.3 3 3 3s3-1.3 3-3c0 1.7 1.3 3 3 3s3-1.3 3-3c0 1.7 1.3 3 3 3s3-1.3 3-3M5 12v9h14v-9M10 21v-5h4v5',
  orders: 'M8 4h8M8 4a2 2 0 0 0-2 2v0H5v15h14V6h-1v0a2 2 0 0 0-2-2M8 4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2M9 11h6M9 15h6',
  wallet: 'M4 7h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a1 1 0 0 1-1-1V7Zm0 0 11-3v3M16 13h4v4h-4a2 2 0 0 1 0-4Z',
  cart: 'M3 4h2l2.4 11h10.2L20 7H6.2M10 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm7 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z',
  bell: 'M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15L6 16Zm4 4h4',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 9a7 7 0 0 1 14 0',
  sprout: 'M12 21v-9m0 0C12 7 9 4 4 4c0 5 3 8 8 8Zm0 0c0-4 2.5-6.5 7-6.5 0 4.5-2.5 6.5-7 6.5Z',
  wheat: 'M12 22V9m0 4c-2.5 0-4-1.5-4-4 2.5 0 4 1.5 4 4Zm0 0c2.5 0 4-1.5 4-4-2.5 0-4 1.5-4 4Zm0-4c-2.5 0-4-1.5-4-4 2.5 0 4 1.5 4 4Zm0 0c2.5 0 4-1.5 4-4-2.5 0-4 1.5-4 4Zm0-4V2',
  handshake: 'M2 12l4-4 4 1 3-2 3 1 6 4M2 12l5 5 2-1 2 2 2-1 2 1 3-3 4-3M8.5 14.5l2 2M11 12.5l3 3',
  truck: 'M2 6h11v10H2zM13 10h4l3 3v3h-7M6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm11 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z',
  rupee: 'M7 4h10M7 8h10M7 4h3a4 4 0 0 1 0 8H7l8 8',
  scale: 'M12 3v3M5 6h14M5 6l-3 7a3 3 0 0 0 6 0L5 6Zm14 0-3 7a3 3 0 0 0 6 0l-3-7ZM9 21h6M12 6v15',
  medal: 'M8 3l2 6M16 3l-2 6M12 21a6 6 0 1 0 0-12 6 6 0 0 0 0 12Zm0-8.5 1 2 2 .3-1.5 1.4.4 2.1-1.9-1-1.9 1 .4-2.1L9 14.8l2-.3 1-2Z',
  chart: 'M3 3v18h18M7 15l4-5 3 3 5-7',
  alert: 'M12 3a5 5 0 0 0-5 5v4l-2 3h14l-2-3V8a5 5 0 0 0-5-5Zm-2 15a2 2 0 0 0 4 0M12 8v2',
  pin: 'M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21Zm0-9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
  list: 'M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01',
  farmer: 'M5 9h14M7 9c0-3 2.2-5 5-5s5 2 5 5M8 9a4 4 0 0 0 8 0M5 21a7 7 0 0 1 14 0',
  shield: 'M12 3 4 6v6c0 4.5 3.4 8 8 9 4.6-1 8-4.5 8-9V6l-8-3Zm-3 9 2 2 4-4',
  file: 'M6 3h8l4 4v14H6zM14 3v4h4M9 12h6M9 16h6',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-3a7.4 7.4 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7.5 7.5 0 0 0-2-1.2L14.5 3h-5l-.4 2.6a7.5 7.5 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7.5 7.5 0 0 0 2 1.2l.4 2.6h5l.4-2.6a7.5 7.5 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2Z',
  complaint: 'M4 5h16v11H9l-5 4V5Zm8 3v3m0 2.5h.01',
  briefcase: 'M3 8h18v12H3zM8 8V5h8v3M3 13h18',
  check: 'M5 12.5l4.5 4.5L19 7',
  chevron: 'M9 6l6 6-6 6',
  plus: 'M12 5v14M5 12h14',
  menu: 'M4 7h16M4 12h16M4 17h16',
};

export type IconName = keyof typeof PATHS;

export default function Icon({ name, size = 22, className }: { name: string; size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d={PATHS[name] ?? PATHS.list} />
    </svg>
  );
}
