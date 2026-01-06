/**
 * Generic Tree Drag and Drop Hook
 * Reusable logic for drag-and-drop in tree structures
 */

import { useState, useCallback } from 'react';
import { DragStartEvent, DragEndEvent, DragOverEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';

export interface TreeNode {
  id: string;
  parentId: string | null;
  index: number;
  depth: number;
}

export interface DropPositionCalculation {
  position: 'above' | 'below' | 'inside';
  targetParentId: string | null;
}

export interface TreeDragDropConfig<TNode extends TreeNode, TResult> {
  /**
   * Flattened tree nodes
   */
  flattenedNodes: TNode[];

  /**
   * Check if a node can be dragged
   */
  canDrag?: (node: TNode) => boolean;

  /**
   * Custom drop position calculation based on cursor position
   * If not provided, uses default threshold-based calculation
   */
  calculateDropPosition?: (
    activeNode: TNode,
    overNode: TNode,
    relativeY: number,
    cursorOffsetY: number
  ) => DropPositionCalculation | null;

  /**
   * Check if dropping activeNode onto/near overNode is valid
   * Receives the calculated position and target parent
   */
  canDrop?: (
    activeNode: TNode,
    overNode: TNode | null,
    position: 'above' | 'below' | 'inside',
    targetParentId: string | null
  ) => boolean;

  /**
   * Rebuild the tree after a successful drop
   * @returns The updated data structure(s) to be saved
   */
  onRebuild: (
    activeNode: TNode,
    newParentId: string | null,
    newOrder: number,
    dropPosition: 'above' | 'below' | 'inside',
    overId: string | null
  ) => TResult;

  /**
   * Called when the tree is successfully reordered
   */
  onReorder?: (result: TResult) => void | Promise<void>;

  /**
   * Callback when a folder should be auto-expanded
   */
  onAutoExpandNode?: (nodeId: string) => void;

  /**
   * Called when drag starts (before setting activeId)
   * Can be used for auto-selecting the dragged item
   */
  onDragStart?: (event: DragStartEvent, node: TNode) => void;

  /**
   * Calculate cursor offset within element on drag start
   * If not provided, uses default (element height / 2)
   */
  calculateCursorOffset?: (event: DragStartEvent) => number;
}

export interface TreeDragDropResult {
  activeId: string | null;
  overId: string | null;
  dropPosition: 'above' | 'below' | 'inside' | null;
  cursorOffsetY: number;
  isDropNotAllowed: boolean;
  sensors: ReturnType<typeof useSensors>;
  handleDragStart: (event: DragStartEvent) => void;
  handleDragOver: (event: DragOverEvent) => void;
  handleDragEnd: (event: DragEndEvent) => void;
  handleDragCancel: () => void;
}

/**
 * Generic hook for tree drag-and-drop functionality
 */
export function useTreeDragDrop<TNode extends TreeNode, TResult>(
  config: TreeDragDropConfig<TNode, TResult>
): TreeDragDropResult {
  const {
    flattenedNodes,
    canDrag,
    canDrop,
    calculateDropPosition,
    onRebuild,
    onReorder,
    onAutoExpandNode,
    onDragStart: onDragStartCallback,
    calculateCursorOffset,
  } = config;

  // Drag state
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [dropPosition, setDropPosition] = useState<'above' | 'below' | 'inside' | null>(null);
  const [cursorOffsetY, setCursorOffsetY] = useState<number>(0);
  const [isDropNotAllowed, setIsDropNotAllowed] = useState<boolean>(false);

  // Setup sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Handle drag start
  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const { active } = event;
      const activeNode = flattenedNodes.find((n) => n.id === active.id);

      // Check if node can be dragged
      if (activeNode && canDrag && !canDrag(activeNode)) {
        return;
      }

      // Calculate cursor offset
      const offset = calculateCursorOffset
        ? calculateCursorOffset(event)
        : event.active.rect.current.initial
          ? event.active.rect.current.initial.height / 2
          : 0;
      setCursorOffsetY(offset);

      // Custom drag start callback (e.g., for auto-selecting)
      if (activeNode && onDragStartCallback) {
        onDragStartCallback(event, activeNode);
      }

      setActiveId(active.id as string);
    },
    [flattenedNodes, canDrag, calculateCursorOffset, onDragStartCallback]
  );

  // Handle drag over
  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { active, over } = event;

      if (!over || !event.over?.rect) {
        setOverId(null);
        setDropPosition(null);
        setIsDropNotAllowed(false);
        return;
      }

      const activeNode = flattenedNodes.find((n) => n.id === active.id);
      const overNode = flattenedNodes.find((n) => n.id === over.id);

      if (!activeNode) return;

      // Calculate pointer position relative to hovered element
      const activeRect = event.active.rect.current;
      if (!activeRect.initial) {
        setOverId(over.id as string);
        setDropPosition(null);
        return;
      }

      const pointerY = activeRect.translated?.top ?? activeRect.initial.top;
      const { top, height } = event.over.rect;

      const actualPointerY = pointerY + cursorOffsetY;
      const offsetY = actualPointerY - top;
      const relativeY = offsetY / height;

      // Calculate drop position (custom or default)
      let position: 'above' | 'below' | 'inside';
      let targetParentId: string | null = null;

      if (calculateDropPosition && overNode) {
        const result = calculateDropPosition(activeNode, overNode, relativeY, cursorOffsetY);
        if (!result) {
          setOverId(null);
          setDropPosition(null);
          setIsDropNotAllowed(false);
          return;
        }
        position = result.position;
        targetParentId = result.targetParentId;
      } else {
        // Default calculation
        const threshold = height / 4;
        if (relativeY < 0.25) {
          position = 'above';
        } else if (relativeY > 0.75) {
          position = 'below';
        } else {
          position = 'inside';
        }
        targetParentId = position === 'inside' && overNode ? overNode.id : overNode?.parentId ?? null;
      }

      // Check if drop is valid
      const dropIsValid = canDrop ? canDrop(activeNode, overNode ?? null, position, targetParentId) : true;

      setIsDropNotAllowed(!dropIsValid);
      setOverId(over.id as string);
      setDropPosition(position);
    },
    [flattenedNodes, cursorOffsetY, calculateDropPosition, canDrop]
  );

  // Handle drag end
  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;

      if (!over || !dropPosition || isDropNotAllowed) {
        setActiveId(null);
        setOverId(null);
        setDropPosition(null);
        setIsDropNotAllowed(false);
        setCursorOffsetY(0);
        return;
      }

      const activeNode = flattenedNodes.find((n) => n.id === active.id);
      const overNode = flattenedNodes.find((n) => n.id === over.id);

      if (!activeNode || activeNode.id === over.id) {
        setActiveId(null);
        setOverId(null);
        setDropPosition(null);
        setCursorOffsetY(0);
        return;
      }

      let newParentId: string | null = null;
      let newOrder = 0;

      if (overNode) {
        if (dropPosition === 'inside') {
          // Drop inside the target node
          newParentId = overNode.id;
          newOrder = 0;

          // Auto-expand the target node
          if (onAutoExpandNode) {
            onAutoExpandNode(overNode.id);
          }
        } else if (dropPosition === 'above') {
          // Drop above the target
          newParentId = overNode.parentId;
          newOrder = overNode.index;
        } else {
          // Drop below the target
          newParentId = overNode.parentId;
          newOrder = overNode.index + 1;
        }
      }

      // Rebuild the tree structure
      const result = onRebuild(activeNode, newParentId, newOrder, dropPosition, over.id as string);

      // Call onReorder with the result
      if (onReorder) {
        await onReorder(result);
      }

      setActiveId(null);
      setOverId(null);
      setDropPosition(null);
      setIsDropNotAllowed(false);
      setCursorOffsetY(0);
    },
    [flattenedNodes, dropPosition, isDropNotAllowed, onRebuild, onReorder, onAutoExpandNode]
  );

  // Handle drag cancel
  const handleDragCancel = useCallback(() => {
    setActiveId(null);
    setOverId(null);
    setDropPosition(null);
    setIsDropNotAllowed(false);
    setCursorOffsetY(0);
  }, []);

  return {
    activeId,
    overId,
    dropPosition,
    cursorOffsetY,
    isDropNotAllowed,
    sensors,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleDragCancel,
  };
}
