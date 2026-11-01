'use client';

import * as React from 'react';

const HISTORY_KEY = '__v9ModalHistoryStack';

type ModalHistoryOptions = {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
};

/**
 * Adds one browser-history entry per open modal. Back closes only the topmost
 * modal; closing a modal normally removes its own entry without leaving a
 * stale Back-button step behind.
 */
export function useModalHistory({
  open: controlledOpen,
  defaultOpen,
  onOpenChange,
}: ModalHistoryOptions) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen ?? false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;
  const onOpenChangeRef = React.useRef(onOpenChange);

  React.useEffect(() => {
    onOpenChangeRef.current = onOpenChange;
  }, [onOpenChange]);

  const handleOpenChange = React.useCallback((nextOpen: boolean) => {
    if (!isControlled) setUncontrolledOpen(nextOpen);
    onOpenChangeRef.current?.(nextOpen);
  }, [isControlled]);

  React.useEffect(() => {
    if (!open || typeof window === 'undefined') return;

    const token = `modal-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const currentState = window.history.state;
    const currentStack = Array.isArray(currentState?.[HISTORY_KEY])
      ? currentState[HISTORY_KEY] as string[]
      : [];

    let historyEntryCreated = false;
    let closedByPopState = false;

    try {
      window.history.pushState(
        {
          ...(currentState && typeof currentState === 'object' ? currentState : {}),
          [HISTORY_KEY]: [...currentStack, token],
        },
        '',
        window.location.href
      );
      historyEntryCreated = true;
    } catch {
      // If the browser disallows history state changes, the modal still works
      // normally through its close button, Escape key, and overlay behavior.
    }

    if (!historyEntryCreated) return;

    const handlePopState = () => {
      const state = window.history.state;
      const stack = Array.isArray(state?.[HISTORY_KEY]) ? state[HISTORY_KEY] as string[] : [];
      // A parent modal must remain open when Back only dismisses a nested one.
      if (stack.includes(token)) return;

      closedByPopState = true;
      handleOpenChange(false);
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      if (closedByPopState) return;

      const state = window.history.state;
      const stack = Array.isArray(state?.[HISTORY_KEY]) ? state[HISTORY_KEY] as string[] : [];
      const tokenIndex = stack.lastIndexOf(token);
      if (tokenIndex === -1) return;

      if (tokenIndex === stack.length - 1) {
        // Consume the history entry created when this modal opened.
        window.history.back();
      } else {
        // A parent was closed while a nested modal is still open. Remove only
        // the parent's marker from the current entry without navigating.
        window.history.replaceState(
          { ...(state && typeof state === 'object' ? state : {}), [HISTORY_KEY]: stack.filter(item => item !== token) },
          '',
          window.location.href
        );
      }
    };
  }, [open, handleOpenChange]);

  return { open, onOpenChange: handleOpenChange };
}
