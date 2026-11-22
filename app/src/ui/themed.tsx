import {
  StyleSheet,
  Switch as RNSwitch,
  Text as RNText,
  TextInput as RNTextInput,
  type SwitchProps,
  type TextInputProps,
  type TextProps,
} from 'react-native';
import { color, fontFamily } from '@/ui/theme';

/**
 * UX-12: the app's Text. Colour defaults to the theme text colour, the font follows `fontWeight`
 * (Gabarito has one file per weight) and figures are tabular. Use this instead of react-native's Text.
 */
export function Text({ style, ...rest }: TextProps) {
  const flat = StyleSheet.flatten(style) ?? {};
  return (
    <RNText
      {...rest}
      style={[
        { color: color.text, fontVariant: ['tabular-nums'] },
        style,
        { fontFamily: flat.fontFamily ?? fontFamily(flat.fontWeight), fontWeight: undefined },
      ]}
    />
  );
}

/** The app's TextInput: light text on glass, muted placeholder, accent caret, dark keyboard. */
export function TextInput({ style, ...rest }: TextInputProps) {
  const flat = StyleSheet.flatten(style) ?? {};
  return (
    <RNTextInput
      placeholderTextColor={color.muted}
      selectionColor={color.accent}
      keyboardAppearance="dark"
      {...rest}
      style={[{ color: color.text }, style, { fontFamily: flat.fontFamily ?? fontFamily(flat.fontWeight), fontWeight: undefined }]}
    />
  );
}

/** The app's Switch: accent when on, a visible off-track (control outline colour). */
export function Switch(props: SwitchProps) {
  return <RNSwitch trackColor={{ false: color.control, true: color.accent }} ios_backgroundColor={color.control} {...props} />;
}
