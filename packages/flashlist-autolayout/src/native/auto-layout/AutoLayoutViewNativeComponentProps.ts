import { ReactNode } from "react";

export interface OnBlankAreaEvent {
  nativeEvent: {
    offsetStart: number;
    offsetEnd: number;
  };
}

type OnBlankAreaEventHandler = (event: OnBlankAreaEvent) => void;

export interface AutoLayoutViewNativeComponentProps {
  children?: ReactNode;
  onBlankAreaEvent: OnBlankAreaEventHandler;
  onAutoLayout?: (event: any) => void;
  enableInstrumentation: boolean;
  disableAutoLayout?: boolean;
  enableAutoLayoutInfo?: boolean;
}
