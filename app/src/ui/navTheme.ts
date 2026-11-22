import { DarkTheme } from 'expo-router';
import { color, fontFamily } from '@/ui/theme';

/** UX-12: the navigation theme: dark, on the ground colour, accent for links and the back arrow. */
export const NAV_THEME = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: color.ground,
    card: color.ground,
    text: color.text,
    primary: color.accent,
    border: 'transparent',
  },
};

/** Header and content colours for every stack (the root one and the nested ones). */
export const SCREEN_OPTIONS = {
  headerStyle: { backgroundColor: color.ground },
  headerTintColor: color.accent,
  headerTitleStyle: { color: color.text, fontFamily: fontFamily('700') },
  headerShadowVisible: false,
  contentStyle: { backgroundColor: color.ground },
};
