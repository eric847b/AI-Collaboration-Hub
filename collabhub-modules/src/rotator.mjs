'use strict';
/**
 * ESM facade for the FreeAI rotator core (src/rotator.js is CommonJS).
 *
 * ESM consumers (Svelte/Next/Vite, etc.) can now do a real named import:
 *   import { FreeAirRotator, defaultProviders, delay } from 'collabhub-modules/src/rotator.mjs';
 * or a default import:
 *   import FreeAI from 'collabhub-modules/src/rotator.mjs';
 *
 * Note: Node's CJS->ESM static analysis does not always surface names from the
 * `module.exports = {...}` in rotator.js, so we re-declare them here as real
 * ESM `export const` bindings (always statically detectable) and re-export the
 * whole CommonJS namespace as `default` via the default import. The package
 * targets Node >= 26.
 */
import cjs from './rotator.js';

export const FreeAirRotator = cjs.FreeAirRotator;
export const defaultProviders = cjs.defaultProviders;
export const delay = cjs.delay;

export default {
  FreeAirRotator: cjs.FreeAirRotator,
  defaultProviders: cjs.defaultProviders,
  delay: cjs.delay,
};
