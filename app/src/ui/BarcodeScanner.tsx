import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRef } from 'react';
import { Linking, View } from 'react-native';
import { t } from '@/i18n';
import { Button, Hint, Label } from '@/ui/components';

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
      <View style={{ gap: 8 }}>
        <Hint>{t('meal.scanPermission')}</Hint>
        {permission.canAskAgain ? (
          <Button kind="secondary" title={t('meal.scanAllow')} onPress={() => void requestPermission()} />
        ) : (
          <Button kind="secondary" title={t('meal.scanSettings')} onPress={() => void Linking.openSettings()} />
        )}
      </View>
    );
  }
  return (
    <View style={{ gap: 8 }}>
      <Label>{t('meal.scanTitle')}</Label>
      <CameraView
        style={{ height: 240, borderRadius: 12, overflow: 'hidden' }}
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
