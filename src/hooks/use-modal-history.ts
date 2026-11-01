'use client';

import * as React from 'react';

const HISTORY_KEY = '__v9ModalHistoryStack';

type ModalHistoryOptions = {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  enabled?: boolean;
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
  enabled = true,
}: ModalHistoryOptions) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen ?? false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;
  const onOpenChangeRef = React.useRef(onOpenChange);
  const pendingHistoryCleanupRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeHistoryTokenRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    onOpenChangeRef.current = onOpenChange;
  }, [onOpenChange]);

  const handleOpenChange = React.useCallback((nextOpen: boolean) => {
    if (!isControlled) setUncontrolledOpen(nextOpen);
    onOpenChangeRef.current?.(nextOpen);
  }, [isControlled]);

  React.useEffect(() => {
    if (!enabled || !open || typeof window === 'undefined') return;

    // React Strict Mode replays effects in development. Cancel a deferred
    // cleanup from the replay before creating the real modal history entry.
    if (pendingHistoryCleanupRef.current) {
      clearTimeout(pendingHistoryCleanupRef.current);
      pendingHistoryCleanupRef.current = null;
    }

    const currentState = window.history.state;
    const currentStack = Array.isArray(currentState?.[HISTORY_KEY])
      ? currentState[HISTORY_KEY] as string[]
      : [];
    // Reuse the same token if React Strict Mode immediately replays this
    // effect; otherwise the development replay would leave a ghost entry.
    const previousToken = activeHistoryTokenRef.current;
    const token = previousToken && currentStack.includes(previousToken)
      ? previousToken
      : `modal-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    let historyEntryCreated = currentStack.includes(token);
    let closedByPopState = false;

    if (!historyEntryCreated) {
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
    }

    if (!historyEntryCreated) {
      activeHistoryTokenRef.current = null;
      return;
    }
    activeHistoryTokenRef.current = token;

    const handlePopState = () => {
      const state = window.history.state;
      const stack = Array.isArray(state?.[HISTORY_KEY]) ? state[HISTORY_KEY] as string[] : [];
      // A parent modal must remain open when Back only dismisses a nested one.
      if (stack.includes(token)) return;

      closedByPopState = true;
      activeHistoryTokenRef.current = null;
      handleOpenChange(false);
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      if (closedByPopState) return;

      const state = window.history.state;
      const stack = Array.isArray(state?.[HISTORY_KEY]) ? state[HISTORY_KEY] as string[] : [];
      const tokenIndex = stack.lastIndexOf(token);
      if (tokenIndex === -1) {
        if (activeHistoryTokenRef.current === token) activeHistoryTokenRef.current = null;
        return;
      }

      if (tokenIndex === stack.length - 1) {
        // Defer one tick so React Strict Mode's setup/cleanup replay can cancel
        // this navigation before it affects the user's actual history.
        pendingHistoryCleanupRef.current = setTimeout(() => {
          pendingHistoryCleanupRef.current = null;
          const latestState = window.history.state;
          const latestStack = Array.isArray(latestState?.[HISTORY_KEY])
            ? latestState[HISTORY_KEY] as string[]
            : [];
          const latestTokenIndex = latestStack.lastIndexOf(token);
          if (latestTokenIndex === latestStack.length - 1) {
            if (activeHistoryTokenRef.current === token) activeHistoryTokenRef.current = null;
            window.history.back();
          } else if (latestTokenIndex !== -1) {
            if (activeHistoryTokenRef.current === token) activeHistoryTokenRef.current = null;
            window.history.replaceState(
              { ...(latestState && typeof latestState === 'object' ? latestState : {}), [HISTORY_KEY]: latestStack.filter(item => item !== token) },
              '',
              window.location.href
            );
          }
        }, 0);
      } else {
        if (activeHistoryTokenRef.current === token) activeHistoryTokenRef.current = null;
        // A parent was closed while a nested modal is still open. Remove only
        // the parent's marker from the current entry without navigating.
        window.history.replaceState(
          { ...(state && typeof state === 'object' ? state : {}), [HISTORY_KEY]: stack.filter(item => item !== token) },
          '',
          window.location.href
        );
      }
    };
  }, [enabled, open, handleOpenChange]);

  return { open, onOpenChange: handleOpenChange };
}
