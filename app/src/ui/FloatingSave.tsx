import { useEffect, useState } from 'react';
import { Keyboard, Platform, Pressable, View } from 'react-native';
import { t } from '@/i18n';
import { Icon, type IconName } from '@/ui/Icon';
import { Text } from '@/ui/themed';
import { color } from '@/ui/theme';

/** The room a form leaves at its end so the last field scrolls clear of the floating Save. */
export const SAVE_INSET = 150;

/** The height of the keyboard while it is up, else 0. */
function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillChangeFrame' : 'keyboardDidShow', (e) =>
      setHeight(e.endCoordinates.height),
    );
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return height;
}

/**
 * UX-3, UX-12: the form's Save. A 56 pt accent pill that floats 26 pt above the bottom edge, or 12 pt above the
 * keyboard while it is up. When something is missing it is the disabled look (white 7 %, text at 38 %) with a line
 * above it that says what is missing.
 */
export function FloatingSave({ disabled, missing, onPress }: { disabled: boolean; missing: string | null; onPress: () => void }) {
  return <FloatingAction title={t('common.save')} icon="check" disabled={disabled} missing={missing} onPress={onPress} />;
}

/**
 * UX-3, UX-12: the single primary action of a screen, floating like the form Save ("Prepare the pack", "Send and
 * analyse", "Create doctor report", "Try again"). `missing` is the line above a disabled button.
 */
export function FloatingAction({
  title,
  icon,
  disabled = false,
  missing = null,
  onPress,
}: {
  title: string;
  icon?: IconName;
  disabled?: boolean;
  missing?: string | null;
  onPress: () => void;
}) {
  const keyboard = useKeyboardHeight();
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 20, right: 20, bottom: keyboard > 0 ? keyboard + 12 : 26, gap: 8 }}>
      {missing !== null ? (
        <Text style={{ fontSize: 13.5, color: color.soft, textAlign: 'center' }}>{t('edit.missing', { what: missing })}</Text>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onPress}
        style={{
          height: 56,
          borderRadius: 999,
          flexDirection: 'row',
          gap: 8,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: disabled ? color.disabledFill : color.accent,
          borderWidth: disabled ? 1 : 0,
          borderColor: color.glassLine,
        }}
      >
        {icon ? <Icon name={icon} size={20} tint={disabled ? color.disabledText : color.onAccent} stroke={2.4} wash={false} /> : null}
        <Text style={{ fontSize: 16.5, fontWeight: '700', color: disabled ? color.disabledText : color.onAccent }}>{title}</Text>
      </Pressable>
    </View>
  );
}
