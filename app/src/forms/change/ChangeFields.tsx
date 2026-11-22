import type { ReactNode } from 'react';
import { CHANGE_ACTIONS, type ChangeAction, type ListItem } from '@/core/model/types';
import { itemLabel, t } from '@/i18n';
import { Chips, styles } from '@/ui/components';
import { one } from '@/ui/sets';
import { SwitchRow } from '@/ui/SwitchRow';
import { TextInput } from '@/ui/themed';

/**
 * IN-12: started or stopped, the category, the name and "date unknown"; shared by the new-entry form and the edit
 * form. `children` go between the category and the name (the new-entry form lists what is in use there).
 */
export function ChangeFields(p: {
  action: ChangeAction;
  onAction: (a: ChangeAction) => void;
  categories: ListItem[];
  category: string;
  onCategory: (id: string) => void;
  name: string;
  onName: (v: string) => void;
  dateUnknown: boolean;
  onDateUnknown: (v: boolean) => void;
  children?: ReactNode;
}) {
  return (
    <>
      <Chips
        items={CHANGE_ACTIONS.map((a) => ({ id: a, label: t(`change.actions.${a}`) }))}
        selected={one(p.action)}
        onToggle={(id) => p.onAction(id as ChangeAction)}
      />
      <Chips items={p.categories.map((c) => ({ id: c.id, label: itemLabel(c) }))} selected={one(p.category)} onToggle={p.onCategory} />
      {p.children}
      <TextInput
        style={styles.input}
        accessibilityLabel={t('more.changeName')}
        placeholder={t('more.changeName')}
        value={p.name}
        onChangeText={p.onName}
      />
      {p.action === 'started' && <SwitchRow title={t('change.dateUnknown')} value={p.dateUnknown} onChange={p.onDateUnknown} />}
    </>
  );
}
