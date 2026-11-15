import React from 'react';
import { act, create } from 'react-test-renderer';
import Slider from '@react-native-community/slider';
import { ScoreInput } from '@/ui/components';
import en from '@/i18n/en.json';

const label = 'Itch';
const byLabel = (tree: ReturnType<typeof create>, l: string) =>
  tree.root.findAll((n) => n.props.accessibilityLabel === l && typeof n.props.onPress === 'function')[0]!;

describe('SK-3, SK-7, UX-3 ScoreInput', () => {
  it('buttons and slider move in whole steps within 0 to 10', async () => {
    const seen: (number | null)[] = [];
    let tree!: ReturnType<typeof create>;
    await act(async () => {
      tree = create(<ScoreInput label={label} value={10} onChange={(v) => seen.push(v)} />);
    });
    await act(async () => byLabel(tree, `${en.common.increase} ${label}`).props.onPress());
    await act(async () => byLabel(tree, `${en.common.decrease} ${label}`).props.onPress());
    await act(async () => tree.root.findByType(Slider).props.onValueChange(3.4));
    await act(async () => tree.root.findByType(Slider).props.onValueChange(42));
    expect(seen).toEqual([10, 9, 3, 10]);
    expect(tree.root.findByType(Slider).props.step).toBe(1);
  });

  it('an optional score shows a dash until set and has Clear', async () => {
    const seen: (number | null)[] = [];
    let tree!: ReturnType<typeof create>;
    await act(async () => {
      tree = create(<ScoreInput optional label={label} value={null} onChange={(v) => seen.push(v)} />);
    });
    expect(JSON.stringify(tree.toJSON())).toContain('–');
    await act(async () => byLabel(tree, `${en.common.increase} ${label}`).props.onPress());
    await act(async () => {
      tree.update(<ScoreInput optional label={label} value={4} onChange={(v) => seen.push(v)} />);
    });
    await act(async () => byLabel(tree, `${en.common.clear} ${label}`).props.onPress());
    expect(seen).toEqual([0, null]);
  });

  it('a required score has no Clear button', async () => {
    let tree!: ReturnType<typeof create>;
    await act(async () => {
      tree = create(<ScoreInput label={label} value={2} onChange={() => {}} />);
    });
    expect(tree.root.findAll((n) => n.props.accessibilityLabel === `${en.common.clear} ${label}`)).toHaveLength(0);
  });
});
