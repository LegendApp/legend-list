// code borrowed from react-native
import { useCallback, useRef } from "react";

function useRefEffect<TInstance>(
    effect: (instance: TInstance) => (() => void) | void
  ): CallbackRef<TInstance> {
    const cleanupRef = useRef<(() => void) | void>(undefined);
  
    return useCallback(
      (instance: TInstance | null) => {
        if (cleanupRef.current) {
          cleanupRef.current();
          cleanupRef.current = undefined;
        }
        if (instance != null) {
          cleanupRef.current = effect(instance);
        }
      },
      [effect]
    );
  }
  
  function useMergeRefs<Instance>(
    ...refs: ReadonlyArray<React.Ref<Instance> | null>
  ): CallbackRef<Instance> {
    const refEffect = useCallback(
      (current: Instance | null) => {
        const cleanups = refs.map((ref) => {
          if (!ref) {
            return undefined;
          }
          if (typeof ref === "function") {
            const cleanup = ref(current);
            return typeof cleanup === "function"
              ? cleanup
              : () => {
                  ref(null);
                };
          } else {
            (ref as React.MutableRefObject<Instance | null>).current = current;
            return () => {
              (ref as React.MutableRefObject<Instance | null>).current = null;
            };
          }
        });
  
        return () => {
          for (const cleanup of cleanups) {
            cleanup?.();
          }
        };
      },
      [...refs] // eslint-disable-line react-hooks/exhaustive-deps
    );
  
    return useRefEffect(refEffect);
  }
  export { useMergeRefs };