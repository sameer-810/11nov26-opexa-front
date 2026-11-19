import Svg, { Path } from 'react-native-svg';

// Line icons on a 24x24 grid (stroke style), drawn with react-native-svg so they work on web and phone.
const PATHS = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  folder: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  clipboard: 'M9 3h6v3H9z M7 4.5H5V21h14V4.5h-2 M8.5 11h7 M8.5 15h5',
  cart: 'M3 3h2l2.4 12h11l2-8H6.2 M8 20a1 1 0 1 0 2 0a1 1 0 1 0-2 0 M17 20a1 1 0 1 0 2 0a1 1 0 1 0-2 0',
  box: 'M21 8 12 3 3 8v8l9 5 9-5z M3 8l9 5 9-5 M12 13v8',
  receipt: 'M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2z M9 8h6 M9 12h6',
  chart: 'M4 20V11 M10 20V5 M16 20v-7 M21 20H3',
  users: 'M16 20v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1 M9 11a4 4 0 1 0 0-8a4 4 0 0 0 0 8 M22 20v-1a4 4 0 0 0-3-3.9 M16 3.1a4 4 0 0 1 0 7.8',
  hardhat: 'M2 18h20 M4 18v-3a8 8 0 0 1 16 0v3 M10 8V4h4v4',
  tool: 'M15 4a5 5 0 0 0-4.6 7L4 17.4 6.6 20l6.4-6.4A5 5 0 0 0 20 9l-3 3-3-1-1-3z',
  trend: 'M3 17l6-6 4 4 8-8 M15 7h6v6',
  shield: 'M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z',
  calendar: 'M4 6h16v15H4z M4 10h16 M8 3v4 M16 3v4',
  bell: 'M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9 M10.3 21a1.9 1.9 0 0 0 3.4 0',
  sliders: 'M4 6h10 M18 6h2 M4 12h4 M12 12h8 M4 18h12 M16 4v4 M10 10v4 M18 16v4',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4 M16 17l5-5-5-5 M21 12H9',
  arrowUp: 'M12 19V5 M5 12l7-7 7 7',
  arrowDown: 'M12 5v14 M19 12l-7 7-7-7',
  truck: 'M1 5h14v11H1z M15 9h4l3 3v4h-7 M4 19a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0-3 0 M16 19a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0-3 0',
  alert: 'M12 3 2 21h20z M12 10v5 M12 18h.01',
  undo: 'M9 14 4 9l5-5 M4 9h11a5 5 0 0 1 0 10h-3',
  rupee: 'M6 4h12 M6 9h12 M15 20 7 13h2a4.5 4.5 0 0 0 0-9',
  funnel: 'M3 4h18l-7 9v6l-4 2v-8z',
  pie: 'M21 12A9 9 0 1 1 12 3v9z M15 3.3A9 9 0 0 1 20.7 9H15z',
  file: 'M14 3H6v18h12V7z M14 3v4h4',
  chevronRight: 'M9 6l6 6-6 6',
  chevronDown: 'M6 9l6 6 6-6',
  clock: 'M12 21a9 9 0 1 0 0-18a9 9 0 0 0 0 18 M12 7v5l3 2',
  lock: 'M5 11h14v10H5z M8 11V7a4 4 0 0 1 8 0v4',
  wallet: 'M3 7h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M16 13.5h2 M3 7l12-4v4',
  check: 'M20 6 9 17l-5-5',
  upload: 'M12 3v12 M7 8l5-5 5 5 M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4',
  store: 'M3 9l2-5h14l2 5 M4 9v11h16V9 M9 20v-6h6v6',
  layers: 'M12 3 2 8l10 5 10-5z M2 13l10 5 10-5',
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 20, color = 'currentColor', strokeWidth = 1.8 }: { name: IconName; size?: number; color?: string; strokeWidth?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d={PATHS[name]} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
