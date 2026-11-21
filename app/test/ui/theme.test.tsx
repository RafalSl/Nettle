import fs from 'fs';
import path from 'path';
import React from 'react';
import { StyleSheet } from 'react-native';
import { act, create } from 'react-test-renderer';
import { ICON_SHAPES } from '@/ui/iconShapes';
import { Icon } from '@/ui/Icon';
import { NavGroup } from '@/ui/NavGroup';
import { NavRow } from '@/ui/NavRow';
import { SwitchRow } from '@/ui/SwitchRow';
import { Text } from '@/ui/themed';
import { color, fontFamily } from '@/ui/theme';

jest.mock('expo-router', () => ({}));

const render = (el: React.ReactElement) => {
  let tree!: ReturnType<typeof create>;
  act(() => {
    tree = create(el);
  });
  return tree;
};

describe('theme (UX-12)', () => {
  it('UX-12 a weight picks the Gabarito file, and Text defaults to the theme colour', () => {
    expect(fontFamily('600')).toBe('Gabarito_600SemiBold');
    expect(fontFamily(undefined)).toBe('Gabarito_400Regular');
    const tree = render(<Text style={{ fontWeight: '800' }}>14 Nov</Text>);
    const style = StyleSheet.flatten(tree.root.findByType('Text' as never).props.style);
    expect(style.fontFamily).toBe('Gabarito_800ExtraBold');
    expect(style.color).toBe(color.text);
    expect(style.fontVariant).toEqual(['tabular-nums']);
  });

  it('UX-12 every icon of the set renders', () => {
    for (const name of Object.keys(ICON_SHAPES)) expect(() => render(<Icon name={name} />)).not.toThrow();
    expect(Object.keys(ICON_SHAPES)).toEqual(expect.arrayContaining(['meal', 'skin', 'nails', 'minus', 'trash']));
  });

  it('UX-12 a switch row is one switch control, a nav row a button, and a group draws every row', () => {
    const onChange = jest.fn();
    const tree = render(
      <>
        <SwitchRow title="Regular" hint="Reminders come later" value={false} onChange={onChange} />
        <NavGroup label="Settings">
          <NavRow title="Areas" onPress={() => undefined} />
          <NavRow title="Delete data" danger onPress={() => undefined} />
        </NavGroup>
      </>,
    );
    const sw = tree.root.findAll((n) => n.props?.accessibilityRole === 'switch' && typeof n.props.onPress === 'function')[0]!;
    act(() => sw.props.onPress());
    expect(onChange).toHaveBeenCalledWith(true);
    expect(tree.root.findAll((n) => n.props?.accessibilityRole === 'button' && n.props.accessibilityLabel).map((n) => n.props.accessibilityLabel)).toEqual(expect.arrayContaining(['Areas', 'Delete data']));
  });

  it('UX-12 no colour literals outside theme.ts (tokens only)', () => {
    const skip = new Set(['theme.ts', 'spike.tsx', 'report.ts', 'migrations.ts', 'types.ts']);
    const found: string[] = [];
    const walk = (dir: string) => {
      for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, f.name);
        if (f.isDirectory()) walk(p);
        else if (/\.(ts|tsx)$/.test(f.name) && !skip.has(f.name) && /#[0-9a-fA-F]{6}\b|rgba?\(/.test(fs.readFileSync(p, 'utf8'))) found.push(path.relative(process.cwd(), p));
      }
    };
    walk(path.join(process.cwd(), 'src'));
    expect(found).toEqual([]);
  });
});
