import { useEffect, useRef, useState } from 'react';
import { Keyboard, type ScrollViewInstance, type HostInstance, useWindowDimensions } from 'react-native';

/**
 * UX-3: keeps "Add ingredient" in view as the list grows. The new row takes focus, so when the keyboard was hidden
 * the scroll waits for it to start sliding out. `onAddLayout` takes the button's position from its onLayout.
 */
export function useAddIngredientScroll(count: number) {
  // Adding an ingredient grows the form; scroll so Add ingredient stays just above the keyboard and the floating Save.
  const scrollRef = useRef<ScrollViewInstance>(null);
  const addBottom = useRef(0);
  const prevCount = useRef(1);
  const scrollY = useRef(0);
  const addRef = useRef<HostInstance>(null);
  const adding = useRef(false); // the add scroll owns the next keyboard show; revealField stays out of its way
  const windowHeight = useWindowDimensions().height;
  // The new row takes focus (autoFocus), so the keyboard slides out when it was hidden: scroll as it starts to slide (keyboardWillShow), so the scroll and the slide are one motion.
  const [focusNew, setFocusNew] = useState<number | null>(null);
  useEffect(() => {
    const grew = count > prevCount.current;
    prevCount.current = count;
    if (!grew) return;
    adding.current = true;
    // The formula below is a first guess; once the keyboard has settled, measure Add ingredient and scroll the remaining gap.
    const correct = (kb: number) => {
      addRef.current?.measureInWindow((_x, y, _w, h) => {
        const over = y + h + 12 - (windowHeight - kb - 120);
        if (over > 0) scrollRef.current?.scrollTo({ y: scrollY.current + over, animated: true });
        adding.current = false;
      });
    };
    const scrollTo = (kb: number) => {
      const visible = windowHeight - kb - 190; // header and the floating Save
      scrollRef.current?.scrollTo({ y: Math.max(0, addBottom.current + 52 - visible), animated: true });
    };
    if (Keyboard.isVisible()) {
      const kb = Keyboard.metrics()?.height ?? 0;
      const first = setTimeout(() => scrollTo(kb), 50); // after the new row is laid out
      const second = setTimeout(() => correct(kb), 450);
      return () => {
        clearTimeout(first);
        clearTimeout(second);
      };
    }
    const sub = Keyboard.addListener('keyboardWillShow', (e) => {
      sub.remove();
      setTimeout(() => scrollTo(e.endCoordinates.height), 0); // the layout of the new row lands first
    });
    const done = Keyboard.addListener('keyboardDidShow', (e) => {
      done.remove();
      correct(e.endCoordinates.height);
    });
    const give = setTimeout(() => {
      sub.remove();
      done.remove();
      adding.current = false;
    }, 2000);
    return () => {
      clearTimeout(give);
      sub.remove();
      done.remove();
    };
  }, [count, windowHeight]);
  // Tapping a field while the keyboard is hidden: the automatic inset usually lifts it; if it is still under the keyboard once the keyboard is up, scroll the difference.
  const onScrollY = (y: number) => {
    scrollY.current = y;
  };
  const revealField = (field: { measureInWindow: (cb: (x: number, y: number, w: number, h: number) => void) => void }) => {
    if (Keyboard.isVisible() || adding.current) return;
    const sub = Keyboard.addListener('keyboardDidShow', (e) => {
      sub.remove();
      field.measureInWindow((_x, y, _w, h) => {
        const limit = windowHeight - e.endCoordinates.height - 120; // the floating Save and some air
        const over = y + h - limit;
        if (over > 0) scrollRef.current?.scrollTo({ y: scrollY.current + over, animated: true });
      });
    });
    setTimeout(() => sub.remove(), 2000);
  };
  /** Where Add ingredient sits in the form, from its onLayout. */
  const onAddLayout = (y: number) => {
    addBottom.current = y;
  };
  return { scrollRef, addRef, onScrollY, revealField, onAddLayout, focusNew, setFocusNew };
}
