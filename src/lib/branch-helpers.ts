/**
 * Branch Helper Utilities
 *
 * Provides utility functions for handling branch-specific data operations
 * This centralizes the pattern of adding branchId to documents when saving
 */

import { BranchContextType } from '@/contexts/branch-context';

/**
 * Adds branchId to a document if currently in branch mode
 *
 * @param baseData - The base data object to add branchId to
 * @param branchContext - The current branch context from useBranch()
 * @returns The data object with branchId added if in branch mode
 */
export function getNewDocumentData<T extends Record<string, any>>(
  baseData: T,
  branchContext: BranchContextType
): T & { branchId?: string } {
  if (branchContext.isBranchMode && branchContext.currentBranchId) {
    return {
      ...baseData,
      branchId: branchContext.currentBranchId,
    };
  }
  return baseData;
}

/**
 * Filters data by branch if currently in branch mode
 *
 * @param items - Array of items to filter
 * @param branchContext - The current branch context from useBranch()
 * @returns Filtered array if in branch mode, otherwise returns all items
 */
export function filterByBranch<T extends Record<string, any>>(
  items: T[],
  branchContext: BranchContextType
): T[] {
  if (!branchContext.isBranchMode || !branchContext.currentBranchId) {
    return items;
  }

  return items.filter(item => item.branchId === branchContext.currentBranchId);
}

/**
 * Checks if a document belongs to the current branch
 *
 * @param document - The document to check
 * @param branchContext - The current branch context from useBranch()
 * @returns true if document belongs to current branch or if not in branch mode
 */
export function belongsToCurrentBranch<T extends Record<string, any>>(
  document: T,
  branchContext: BranchContextType
): boolean {
  if (!branchContext.isBranchMode) {
    return true; // In global mode, all documents are visible
  }

  if (!branchContext.currentBranchId) {
    return false; // No current branch selected
  }

  return (document as any).branchId === branchContext.currentBranchId;
}

/**
 * Creates a Firestore query constraint for branch filtering
 *
 * @param branchContext - The current branch context from useBranch()
 * @returns An object with branchId if in branch mode, null otherwise
 */
export function getBranchFilterConstraint(branchContext: BranchContextType) {
  if (branchContext.isBranchMode && branchContext.currentBranchId) {
    return { branchId: branchContext.currentBranchId };
  }
  return null;
}

/**
 * Merges branch-isolated data with global data
 * Used when you need to show both branch-specific and global items
 *
 * @param branchItems - Items from the branch collection
 * @param globalItems - Items from the global collection
 * @param branchContext - The current branch context from useBranch()
 * @returns Merged array - branch items if in branch mode, otherwise global items
 */
export function mergeBranchAndGlobalData<T extends Record<string, any>>(
  branchItems: T[],
  globalItems: T[],
  branchContext: BranchContextType
): T[] {
  if (branchContext.isBranchMode) {
    return branchItems;
  }
  return globalItems;
}
