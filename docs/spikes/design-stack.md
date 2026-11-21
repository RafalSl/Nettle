# Spike: the design stack in Expo Go (UX-12)

Question: do blur, SVG, the Gabarito font, reanimated and a floating Save run in Expo Go on the iPhone, at a usable speed?

## Built (2026-11-21)

`app/src/app/spike.tsx`, route `/spike`. Open it in Expo Go with the deep link `exp://<host>:8081/--/spike` (the host is the one `npx expo start` prints), or type `nettle:///spike` into Safari after opening the project once. It shows:

- three blurred glows drifting in 18, 22 and 26 s loops (reanimated);
- a glass ring (`expo-blur` `BlurView`, intensity 22, dark tint) with an SVG track, an accent arc that draws in over 1.4 s (`react-native-svg` plus `useAnimatedProps`) and a washed icon (SVG gradient);
- Gabarito 400, 600 and 800 through `@expo-google-fonts/gabarito` and `useFonts`, with tabular figures on the date;
- a swipe on the ring that changes the day (a plain `PanResponder`);
- a field in glass and a floating Save pill that rides above the keyboard (`useAnimatedKeyboard`).

Checked in this session: typecheck, lint, and an iOS bundle (`expo export`) with the new packages. Not checked: how it looks and feels on a device.

## Decisions taken without a device

- **Gestures:** `react-native-gesture-handler` 3.3 renamed its classic API to `Legacy*` and has a new hooks API. A `PanResponder` does the ring swipe and the row swipe with no new library, so the app does not depend on gesture-handler. It stays installed for now.
- **Fallback:** if blur stutters with the aurora behind it, `GlassSurface` falls back to a flat translucent fill. The component keeps that switch in one place.

## To check on the phone (about 10 minutes)

1. Does the aurora drift smoothly with the blurred ring and field on top (no dropped frames)?
2. Do the three Gabarito weights render, and is the date in tabular figures?
3. Does the arc draw in once, and does the swipe change the day without fighting a scroll?
4. Does the Save pill stay above the keyboard while typing?

Result (2026-11-21, iPhone, Expo Go): passed. The aurora drifts smoothly under the blur (no stutter, so `USE_BLUR` stays on); the three Gabarito weights and tabular figures render; the arc draws in and the ring swipe changes the day. Two spike-only flaws, not stack problems: the leaf icon sat behind the date text, and the swipe right also triggered iOS back-navigation because the spike was a pushed screen (the real Today is a tab root and swipes fine). The keyboard test showed a real gap: a focused field hid behind the keyboard; fixed with `automaticallyAdjustKeyboardInsets` on the shared `Screen` scroll view. The spike screen is deleted.
