# Slower Acceleration Design

## Intent
Make every vehicle accelerate much more gradually so driving through Unterwart is easier to control, while preserving each vehicle's relative character.

## Approved tuning
- Mitsubishi Eclipse 1995: acceleration `24` → `6`
- Alpine Rally RS: acceleration `28` → `7`
- Trailmaster 4x4: acceleration `20` → `5`

Top speed, braking, steering, grip, prices, classes, and all other vehicle properties remain unchanged.

## Approaches
- **Selected: tune vehicle content values.** Smallest change; preserves the existing physics model and gives exact per-vehicle control.
- Rejected: globally scale acceleration in `VehicleRuntime`; this hides the effective values and makes future vehicle balancing less clear.
- Rejected: add throttle ramping; this changes input behavior rather than only acceleration and is unnecessary for the requested tuning.

## Verification
A content test asserts the exact approved acceleration values and confirms the vehicles retain their existing top speeds.
