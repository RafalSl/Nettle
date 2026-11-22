import { useEffect, useRef, useState } from 'react';
import { Keyboard, type ScrollViewInstance, useWindowDimensions } from 'react-native';

/**
 * UX-3: keeps "Add ingredient" in view as the list grows. The new row takes focus, so when the keyboard was hidden
 * the scroll waits for it to start sliding out. `onAddLayout` takes the button's position from its onLayout.
 */
export function useAddIngredientScroll(count: number) {
  // Adding an ingredient grows the form; scroll so Add ingredient stays just above the keyboard and the floating Save.
  const scrollRef = useRef<ScrollViewInstance>(null);
  const addBottom = useRef(0);
  const prevCount = useRef(1);
  const windowHeight = useWindowDimensions().height;
  // The new row takes focus (autoFocus), so the keyboard slides out when it was hidden: scroll as it starts to slide (keyboardWillShow), so the scroll and the slide are one motion.
  const [focusNew, setFocusNew] = useState<number | null>(null);
  useEffect(() => {
    const grew = count > prevCount.current;
    prevCount.current = count;
    if (!grew) return;
    const scrollTo = (kb: number) => {
      const visible = windowHeight - kb - 190; // header and the floating Save
      scrollRef.current?.scrollTo({ y: Math.max(0, addBottom.current + 52 - visible), animated: true });
    };
    if (Keyboard.isVisible()) {
      setTimeout(() => scrollTo(Keyboard.metrics()?.height ?? 0), 50); // after the new row is laid out
      return;
    }
    const sub = Keyboard.addListener('keyboardWillShow', (e) => {
      sub.remove();
      setTimeout(() => scrollTo(e.endCoordinates.height), 0); // the layout of the new row lands first
    });
    const give = setTimeout(() => sub.remove(), 2000);
    return () => {
      clearTimeout(give);
      sub.remove();
    };
  }, [count, windowHeight]);
  /** Where Add ingredient sits in the form, from its onLayout. */
  const onAddLayout = (y: number) => {
    addBottom.current = y;
  };
  return { scrollRef, onAddLayout, focusNew, setFocusNew };
}
