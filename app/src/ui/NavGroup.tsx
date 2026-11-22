import { Children, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { GlassSurface } from '@/ui/GlassSurface';
import { Text } from '@/ui/themed';
import { color } from '@/ui/theme';

/** UX-12: a section label above a glass panel of rows with hairlines between them. */
export function NavGroup({ label, children }: { label?: string; children: ReactNode }) {
  const rows = Children.toArray(children);
  return (
    <View style={{ gap: 8 }}>
      {label ? (
        <Text style={{ fontSize: 13, fontWeight: '600', letterSpacing: 1.4, color: color.muted, textTransform: 'uppercase' }}>{label}</Text>
      ) : null}
      <GlassSurface style={{ borderRadius: 26, paddingHorizontal: 14 }}>
        {rows.map((row, i) => (
          <View
            key={i}
            style={i < rows.length - 1 ? { borderBottomWidth: StyleSheet.hairlineWidth, borderColor: color.glassLine } : undefined}
          >
            {row}
          </View>
        ))}
      </GlassSurface>
    </View>
  );
}
