#!/bin/bash

# Thank you to @ @naqvitalha for this script!
# https://gist.github.com/naqvitalha/8ac4404a65bd314906447541f2e6baf1
#
# Continuous ADB Scroll Down Script with Speed Control
# Continuously swipes down a fixed distance until manually stopped (Ctrl+C).
# An optional speed multiplier can be provided as an argument.
# Usage: ./adb_scroll.sh [SPEED_MULTIPLIER] [DURATION_MS]
#
# Arguments:
#   SPEED_MULTIPLIER: Optional. Multiplier for swipe speed. Higher is faster (shorter duration). Default: 1
#   DURATION_MS: Optional. Duration to run the script in milliseconds. Default: -1 (run forever)
#
# Example:
#   ./adb_scroll.sh       # Run with default speed (1x) forever
#   ./adb_scroll.sh 3     # Run 3x faster forever
#   ./adb_scroll.sh 2 5000     # Run 2x faster for 5000ms (5 seconds)
#   ./adb_scroll.sh "" 3000    # Run default speed for 3000ms (3 seconds)

# --- Configuration ---
START_Y=1500              # Starting Y coordinate for the swipe (near bottom)
X=2                    # X coordinate for the swipe (center)
SWIPE_DISTANCE=700          # Fixed distance for each swipe (pixels)
BASE_SWIPE_DURATION=48     # Base duration for each swipe (milliseconds) - will be divided by multiplier
DEFAULT_SPEED_MULTIPLIER=1  # Default speed multiplier if none provided
SLEEP_BETWEEN=100    # Sleep time between swipes (milliseconds)
DEFAULT_DURATION=-1        # Default duration in milliseconds (-1 means run forever)

# --- Argument Parsing ---
SPEED_MULTIPLIER=${1:-$DEFAULT_SPEED_MULTIPLIER}
DURATION=${2:-$DEFAULT_DURATION}

# --- Input Validation ---
if ! [[ "$SPEED_MULTIPLIER" =~ ^[0-9]*\.?[0-9]+$ ]] || (( $(echo "$SPEED_MULTIPLIER <= 0" | bc -l) )); then
  echo "Error: SPEED_MULTIPLIER must be a positive number."
  exit 1
fi

if ! [[ "$DURATION" =~ ^-?[0-9]+$ ]]; then
  echo "Error: DURATION must be an integer (use -1 for infinite)."
  exit 1
fi

# --- Calculations ---
# Calculate actual swipe duration
SWIPE_DURATION=$(echo "scale=0; $BASE_SWIPE_DURATION / $SPEED_MULTIPLIER" | bc)

# Ensure duration is at least 1ms
if [ -z "$SWIPE_DURATION" ] || [ "$SWIPE_DURATION" -lt 1 ]; then
  SWIPE_DURATION=1
fi

END_Y=$(( START_Y - SWIPE_DISTANCE ))

# Clamp END_Y to 0 if it goes below zero
if [ "$END_Y" -lt 0 ]; then
  END_Y=0
fi

echo "Starting continuous ADB scroll down..."
echo "Press Ctrl+C to stop."
echo "-------------------------------"
echo "Device: $(adb devices | grep -v List | cut -f1)"
echo "Speed Multiplier: ${SPEED_MULTIPLIER}x"
echo "Base Swipe Duration: ${BASE_SWIPE_DURATION}ms"
echo "Effective Swipe Duration: ${SWIPE_DURATION}ms"
echo "Swipe: X=$X, Y: $START_Y -> $END_Y"
echo "Sleep Between: ${SLEEP_BETWEEN}ms"
if [ "$DURATION" -ne -1 ]; then
  echo "Duration: ${DURATION}ms"
fi
echo "-------------------------------"

# Calculate start time for duration tracking
START_TIME=$(date +%s)  # Current time in seconds

while true; do
  # Execute the swipe command
  adb shell input swipe $X $START_Y $X $END_Y $SWIPE_DURATION

  # Brief pause
  sleep $(echo "scale=6; $SLEEP_BETWEEN / 1000" | bc)

  # Check if we've reached the duration limit (if set)
  if [ "$DURATION" -ne -1 ]; then
    CURRENT_TIME=$(date +%s)
    ELAPSED_TIME_SEC=$(( CURRENT_TIME - START_TIME ))
    ELAPSED_TIME_MS=$(( ELAPSED_TIME_SEC * 1000 ))

    if [ "$ELAPSED_TIME_MS" -ge "$DURATION" ]; then
      echo "Duration limit of ${DURATION}ms reached. Stopping."
      break
    fi
  fi
done

# This part is reached when duration is complete or if the loop is broken
echo "-------------------------------"
echo "ADB scroll stopped."
exit 0