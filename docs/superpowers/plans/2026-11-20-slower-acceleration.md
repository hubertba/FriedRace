# Slower Acceleration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce all vehicle acceleration values to the approved slower tuning without changing other handling values.

**Architecture:** Keep the existing vehicle and physics architecture unchanged. Pin the balancing values in a content-level unit test, then update only `src/content/vehicles.ts`.

**Tech Stack:** TypeScript, Vitest

**Spec:** `docs/superpowers/specs/2026-11-20-slower-acceleration-design.md`

## Global Constraints

- Eclipse acceleration must be `6`.
- Rally RS acceleration must be `7`.
- Trailmaster acceleration must be `5`.
- Top speeds, braking, steering, and grip must not change.

## Review Focus

- Vehicle IDs must map to the intended acceleration values.
- Top-speed values must remain unchanged.
- Existing driving and rally flows must continue passing.

---

### Task 1: Tune vehicle acceleration

**Files:**
- Create: `tests/content/vehicles.test.ts`
- Modify: `src/content/vehicles.ts`

**Interfaces:**
- Consumes: exported `VEHICLES` content array.
- Produces: unchanged `VehicleDefinition` objects with approved acceleration values.

- [ ] **Step 1: Write the failing content test**

Assert exact acceleration values `{ eclipse: 6, rally: 7, offroad: 5 }` and unchanged top speeds `{ 210, 190, 155 }` by vehicle ID.

- [ ] **Step 2: Run the test and verify RED**

Run: `npm test -- tests/content/vehicles.test.ts`
Expected: FAIL because current acceleration values are `24`, `28`, and `20`.

- [ ] **Step 3: Apply the approved values**

Change only the three `acceleration` properties in `src/content/vehicles.ts`.

- [ ] **Step 4: Verify GREEN and regressions**

Run: `npm test && npm run test:e2e && npm run build`
Expected: all tests and build pass.

- [ ] **Step 5: Commit and publish**

Commit with `fix: slow vehicle acceleration`, push `main`, and reopen the local game.
