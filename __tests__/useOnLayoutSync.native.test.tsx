import * as React from "react";
import { describe, it, expect, beforeEach } from "bun:test";
import { renderHook } from "@testing-library/react-native";
import { useOnLayoutSync } from "@/hooks/useOnLayoutSync.native";

// Import the shared test setup
import "./setup";

describe("useOnLayoutSync", () => {
  beforeEach(() => {
    // Clear any previous mocks
    jest.clearAllMocks();
  });

  it("should call onLayoutChange with initial layout dimensions", () => {
    const onLayoutChange = jest.fn();
    const ref = React.createRef<any>();

    // Mock the ref.current with layout data
    ref.current = {
      _internalFiberInstance: {
        stateNode: {
          props: {
            layout: { width: 100, height: 200 }
          }
        }
      }
    };

    const { result } = renderHook(() =>
      useOnLayoutSync({ onLayoutChange, ref })
    );

    // Verify that onLayoutChange was called with initial layout
    expect(onLayoutChange).toHaveBeenCalledWith(
      { width: 100, height: 200 },
      true // didLayoutRef should be true after initial setup
    );
  });

  it("should not call onLayoutChange if layout hasn't changed", () => {
    const onLayoutChange = jest.fn();
    const ref = React.createRef<any>();

    // Mock the ref.current with layout data
    ref.current = {
      _internalFiberInstance: {
        stateNode: {
          props: {
            layout: { width: 100, height: 200 }
          }
        }
      }
    };

    const { result } = renderHook(() =>
      useOnLayoutSync({ onLayoutChange, ref })
    );

    // Simulate a layout event with same dimensions
    const onLayout = result.current.onLayout;
    onLayout({
      nativeEvent: {
        layout: { width: 100, height: 200 }
      }
    });

    // Should not be called again since dimensions haven't changed
    expect(onLayoutChange).toHaveBeenCalledTimes(1);
  });

  it("should call onLayoutChange when layout dimensions change", () => {
    const onLayoutChange = jest.fn();
    const ref = React.createRef<any>();

    // Mock the ref.current with layout data
    ref.current = {
      _internalFiberInstance: {
        stateNode: {
          props: {
            layout: { width: 100, height: 200 }
          }
        }
      }
    };

    const { result } = renderHook(() =>
      useOnLayoutSync({ onLayoutChange, ref })
    );

    // Simulate a layout event with different dimensions
    const onLayout = result.current.onLayout;
    onLayout({
      nativeEvent: {
        layout: { width: 150, height: 250 }
      }
    });

    // Should be called since dimensions have changed
    expect(onLayoutChange).toHaveBeenCalledWith(
      { width: 150, height: 250 },
      true // didLayoutRef should be true
    );
  });

  it("should handle ref.current being null or undefined", () => {
    const onLayoutChange = jest.fn();
    const ref = React.createRef<any>();

    // Mock the ref.current as null
    ref.current = null;

    const { result } = renderHook(() =>
      useOnLayoutSync({ onLayoutChange, ref })
    );

    // Should not crash and should not call onLayoutChange
    expect(onLayoutChange).not.toHaveBeenCalled();
  });

  it("should handle missing layout data in ref.current", () => {
    const onLayoutChange = jest.fn();
    const ref = React.createRef<any>();

    // Mock the ref.current without layout data
    ref.current = {
      _internalFiberInstance: {
        stateNode: {
          props: {}
        }
      }
    };

    const { result } = renderHook(() =>
      useOnLayoutSync({ onLayoutChange, ref })
    );

    // Should not crash and should not call onLayoutChange
    expect(onLayoutChange).not.toHaveBeenCalled();
  });
});