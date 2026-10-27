import { useMemo, DependencyList } from 'react';

/**
 * A custom hook that derives a value from a factory function and a dependency list.
 * It uses `useMemo` to efficiently re-compute the value only when dependencies change,
 * avoiding unecessary re-renders associated with a `useState` and `useEffect` combination for derived state.
 *
 * @example
 * const complexValue = useDerivedValue(() => {
 *   // expensive calculation based on props
 *   return props.a + props.b;
 * }, [props.a, props.b]);
 *
 * @param factory The function to compute the value.
 * @param deps The dependency list, same as for `useMemo`.
 * @returns The memoized value.
 */
export const useDerivedValue = <T>(
  factory: () => T,
  deps: DependencyList
): T => {
  return useMemo(factory, deps);
};
