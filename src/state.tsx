import { StateContext, StateValues } from './types';
import { createContext, PropsWithChildren, useContext, useReducer, useState } from 'react';

// This is an implementation of a simple state management system, inspired by Legend State.
// It stores values and listeners in Maps, with peek$ and set$ functions to get and set values.
// The set$ function also triggers the listeners.
//
// This is definitely not general purpose and has one big optimization/caveat: use$ is only ever called
// once for each unique name. So we don't need to manage a Set of listeners or dispose them,
// which saves needing useEffect hooks or managing listeners in a Set.

const ContextListener = createContext<StateContext | null>(null);

export const StateProvider = (props: PropsWithChildren) => {
  const { children } = props;
  const [value] = useState(
    () =>
      ({
        listeners: new Map(),
        values: {},
      }) satisfies StateContext,
  );
  return <ContextListener.Provider value={value}>{children}</ContextListener.Provider>;
};

export const useStateContext = () => {
  const value = useContext(ContextListener);
  if (!value) {
    throw new Error('useStateContext must be used within a StateProvider');
  }
  return value;
};

export const use$ = <TSignal extends keyof StateValues>(signalName: TSignal) => {
  const { listeners, values } = useStateContext();
  const [, forceUpdate] = useReducer((x: number) => x + 1, 0);
  listeners.set(signalName, forceUpdate);

  return values[signalName];
};

export function peek$<TSignal extends keyof StateValues>(ctx: StateContext, signalName: TSignal) {
  const { values } = ctx;
  return values[signalName];
}

export function set$<TSignal extends keyof StateValues>(
  ctx: StateContext,
  signalName: TSignal,
  value: StateValues[TSignal],
) {
  const { listeners, values } = ctx;
  if (values[signalName] !== value) {
    values[signalName] = value;
    listeners.get(signalName)?.();
  }
}
