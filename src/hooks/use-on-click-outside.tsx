
'use client';

import { useEffect, RefObject } from 'react';

type Event = MouseEvent | TouchEvent;

export const useOnClickOutside = <T extends HTMLElement = HTMLElement>(
  ref: RefObject<T> | RefObject<T>[],
  handler: (event: Event) => void
) => {
  useEffect(() => {
    const listener = (event: Event) => {
      const refs = Array.isArray(ref) ? ref : [ref];
      let clickedInside = false;

      for (const r of refs) {
        if (!r.current || r.current.contains(event.target as Node)) {
          clickedInside = true;
          break;
        }
      }

      if (!clickedInside) {
        handler(event);
      }
    };

    document.addEventListener('mousedown', listener);
    document.addEventListener('touchstart', listener);

    return () => {
      document.removeEventListener('mousedown', listener);
      document.removeEventListener('touchstart', listener);
    };
  }, [ref, handler]);
};
