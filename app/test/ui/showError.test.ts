import { Alert, Linking } from 'react-native';
import en from '@/i18n/en.json';
import { NettleError } from '@/core/model/errors';
import { showError } from '@/ui/showError';

describe('showError (IN-8, IN-9, NO-3, NF-3)', () => {
  afterEach(() => jest.restoreAllMocks());

  it('IN-9 a refused permission explains itself and offers Open iPhone settings and Not now', () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const open = jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined);
    showError(new NettleError('photo_permission_denied'));
    const [title, , buttons] = alert.mock.calls[0] as unknown as [string, undefined, { text: string; onPress?: () => void }[]];
    expect(title).toBe(en.errors.photo_permission_denied);
    expect(buttons.map((b) => b.text)).toEqual([en.common.notNow, en.meal.openIphoneSettings]);
    buttons[1]!.onPress!();
    expect(open).toHaveBeenCalled();
  });

  it('NF-3 any other error is a plain alert with its message', () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    showError(new NettleError('invalid_value'));
    expect(alert).toHaveBeenCalledWith(en.errors.invalid_value);
    showError(new Error('secret detail'));
    expect(alert).toHaveBeenLastCalledWith(en.errors.generic);
  });
});
