import * as React from 'react';
import type { ViewProps, ViewStyle } from 'react-native';
import { LeanView } from './LeanView';
import { use$ } from './state';
import type { StateType } from './types';

interface ContainerStyleProps extends ViewProps {
  $key: StateType;
  $style: () => ViewStyle;
}

// A component that listens to a signal and updates its style based on the signal.
// This is a performance optimization to avoid unnecessary renders because it doesn't need to re-render the entire component.
export const $View = (props: ContainerStyleProps) => {
  const { $key, $style, ...rest } = props;
  // Just listen to the key so that the component re-renders when the key changes.
  use$($key);
  // Use the style function to create the style prop.
  const style = $style();
  return <LeanView style={style} {...rest} />;
};
