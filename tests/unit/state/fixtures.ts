import type { SetupConfiguration } from '../../../src/state';
import { createInitialState, reduceAppState } from '../../../src/state';
import { makeParticipants } from '../engine/fixtures';

export function configuration(count = 7): SetupConfiguration {
  return {
    participants: makeParticipants(count),
    couples: [{ firstId: 'p0', secondId: 'p1' }],
    previousDraws: [{ giverId: 'p2', receiverId: 'p3' }],
    manualRestrictions: [{ giverId: 'p4', receiverId: 'p5' }],
    currency: 'PLN',
    budgetRange: { min: 10, max: 2000 },
    adminPreviewEnabled: false,
  };
}

export function drawingState() {
  let state = createInitialState(2026);
  state = reduceAppState(state, { type: 'CONFIGURE', configuration: configuration() });
  state = reduceAppState(state, { type: 'START_BUDGET' });
  state = reduceAppState(state, { type: 'SET_BUDGET', amount: 101 });
  return reduceAppState(state, { type: 'START_DRAWING' });
}