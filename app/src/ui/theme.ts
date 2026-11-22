/**
 * UX-12: every colour, type and shape value of the Aurora ring design, in one place (docs/design-system.md).
 * Screens and components import from here; no colour literals anywhere else.
 */
import {
  Gabarito_400Regular,
  Gabarito_500Medium,
  Gabarito_600SemiBold,
  Gabarito_700Bold,
  Gabarito_800ExtraBold,
} from '@expo-google-fonts/gabarito';

export const color = {
  ground: '#070B12',
  auroraB: '#6D4AE0',
  auroraC: '#2563EB',
  text: '#F2F5F9',
  soft: '#C9D0DA',
  muted: '#9AA4B2',
  accent: '#5EEAD4',
  onAccent: '#062A26',
  alert: '#FF8A6B',
  onAlert: '#2A0D04',
  accentSoft: 'rgba(94,234,212,0.16)',
  accentLine: 'rgba(94,234,212,0.45)',
  alertSoft: 'rgba(255,138,107,0.13)',
  alertLine: 'rgba(255,138,107,0.39)',
  glassFill: 'rgba(255,255,255,0.07)',
  glassFillRaised: 'rgba(255,255,255,0.09)',
  glassLine: 'rgba(255,255,255,0.12)',
  glassLineRaised: 'rgba(255,255,255,0.15)',
  /** Outlines of controls (chips, switch track, radio ring): white 34 %, about 3:1 on the ground. */
  control: 'rgba(255,255,255,0.34)',
  sheetFill: 'rgba(13,19,29,0.88)',
  scrim: 'rgba(0,0,0,0.5)',
  disabledFill: 'rgba(255,255,255,0.07)',
  disabledText: 'rgba(242,245,249,0.38)',
  dotGrid: 'rgba(255,255,255,0.06)',
} as const;

export const radius = { pill: 999, panel: 28, sheet: 36, photo: 22 } as const;
export const space = { margin: 20, group: 8, section: 16 } as const;

/** Gabarito, one font file per weight. */
export const FONT_FILES = { Gabarito_400Regular, Gabarito_500Medium, Gabarito_600SemiBold, Gabarito_700Bold, Gabarito_800ExtraBold };

const FAMILY: Record<string, string> = {
  '400': 'Gabarito_400Regular',
  normal: 'Gabarito_400Regular',
  '500': 'Gabarito_500Medium',
  '600': 'Gabarito_600SemiBold',
  '700': 'Gabarito_700Bold',
  bold: 'Gabarito_700Bold',
  '800': 'Gabarito_800ExtraBold',
  '900': 'Gabarito_800ExtraBold',
};
/** The font file for a `fontWeight` value; Gabarito has no variable font here, so a weight picks a file. */
export const fontFamily = (weight?: string | number): string => FAMILY[String(weight ?? '400')] ?? 'Gabarito_400Regular';

/** Type styles of the spec. Tabular figures are on everywhere (they are set on every text). */
export const type = {
  screenTitle: { fontSize: 32, fontWeight: '800', letterSpacing: -1 },
  formTitle: { fontSize: 17, fontWeight: '700' },
  rowTitle: { fontSize: 16, fontWeight: '600' },
  body: { fontSize: 15, fontWeight: '400' },
  sectionLabel: { fontSize: 13, fontWeight: '600', letterSpacing: 1.4 },
  caption: { fontSize: 13, fontWeight: '400' },
} as const;

/** Wash of the icons: accent fading in from transparent to about 70 %. */
export const WASH = { from: 0, to: 0.7 } as const;
