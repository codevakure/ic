/**
 * Global reference to the ask function for MCP UI actions.
 * 
 * This is needed because MCP UI panels are rendered in a side panel that's
 * outside the ChatContext.Provider tree. We store a reference to the ask
 * function here so that MCPUIResourcePanel can access it.
 * 
 * The reference is updated by MCPUIResource component which is inside
 * ChatContext and has access to the ask function.
 */

import type { TAskFunction } from '~/common';

// Module-level storage for the ask function reference
let currentAskRef: TAskFunction | null = null;

/**
 * Set the current ask function reference.
 * Called from components inside ChatContext.
 */
export function setMCPAskRef(ask: TAskFunction | undefined) {
  currentAskRef = ask ?? null;
}

/**
 * Get the current ask function reference.
 * Called from MCPUIResourcePanel which may be outside ChatContext.
 */
export function getMCPAskRef(): TAskFunction | null {
  return currentAskRef;
}

/**
 * Clear the ask function reference.
 * Called when ChatContext unmounts.
 */
export function clearMCPAskRef() {
  currentAskRef = null;
}
