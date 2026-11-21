import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRef } from 'react';
import { Linking, View } from 'react-native';
import { t } from '@/i18n';
import { Button, Label } from '@/ui/components';
import { GlassSurface } from '@/ui/GlassSurface';
import { Icon } from '@/ui/Icon';
import { Text } from '@/ui/themed';
import { color } from '@/ui/theme';

/**
 * IN-2: a camera view that reports the first EAN or UPC code it sees. Without camera permission it explains why
 * and offers the system settings when the permission cannot be asked for again; the code can still be typed.
 */
export function BarcodeScanner({ onCode }: { onCode: (code: string) => void }) {
  const [permission, requestPermission] = useCameraPermissions();
  const done = useRef(false);
  if (!permission) return null;
  if (!permission.granted) {
    return (
      <GlassSurface style={{ borderRadius: 26, padding: 16, gap: 10, alignItems: 'center' }}>
        <Icon name="camera" size={40} tint={color.alert} />
        <Text style={{ fontSize: 20, fontWeight: '800', letterSpacing: -0.4 }}>{t('meal.scanCameraOff')}</Text>
        <Text style={{ fontSize: 15, color: color.soft, textAlign: 'center' }}>{t('meal.scanPermission')}</Text>
        {permission.canAskAgain ? (
          <Button title={t('meal.scanAllow')} onPress={() => void requestPermission()} />
        ) : (
          <Button title={t('meal.scanSettings')} onPress={() => void Linking.openSettings()} />
        )}
      </GlassSurface>
    );
  }
  return (
    <View style={{ gap: 8 }}>
      <Label>{t('meal.scanTitle')}</Label>
      <CameraView
        style={{ height: 240, borderRadius: 28, overflow: 'hidden' }}
        barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }}
        onBarcodeScanned={({ data }) => {
          if (done.current) return; // the camera reports the same code many times a second
          done.current = true;
          onCode(data);
        }}
      />
    </View>
  );
}
