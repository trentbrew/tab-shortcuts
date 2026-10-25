export function getSegmentBounds(tabs, tab) {
  const pinnedCount = tabs.filter((t) => t.pinned).length;
  const isPinned = tab.pinned;

  const segmentStart = isPinned ? 0 : pinnedCount;
  const segmentEnd = isPinned ? pinnedCount - 1 : tabs.length - 1;

  return { segmentStart, segmentEnd };
}

export function groupIdOf(tab) {
  return tab && !tab.pinned && tab.groupId !== undefined && tab.groupId !== -1
    ? tab.groupId
    : null;
}

// Decide group membership after a one-step move. Prefer the tab's original
// group when either neighbor still belongs to it, so landing on a group's
// last slot does not get pulled into the adjacent group on the other side.
export function resolveGroupAfterMove(originalGroup, leftNeighbor, rightNeighbor, direction) {
  if (originalGroup !== null) {
    const leftInOriginal = groupIdOf(leftNeighbor) === originalGroup;
    const rightInOriginal = groupIdOf(rightNeighbor) === originalGroup;

    if (leftInOriginal || rightInOriginal) {
      return { action: 'join', groupId: originalGroup };
    }

    const leadNeighbor = direction > 0 ? rightNeighbor : leftNeighbor;
    const trailNeighbor = direction > 0 ? leftNeighbor : rightNeighbor;
    const joinGroup = groupIdOf(leadNeighbor) ?? groupIdOf(trailNeighbor);

    if (joinGroup !== null) {
      return { action: 'join', groupId: joinGroup };
    }

    return { action: 'leave' };
  }

  const leadNeighbor = direction > 0 ? rightNeighbor : leftNeighbor;
  const trailNeighbor = direction > 0 ? leftNeighbor : rightNeighbor;
  const joinGroup = groupIdOf(leadNeighbor) ?? groupIdOf(trailNeighbor);

  if (joinGroup !== null) {
    return { action: 'join', groupId: joinGroup };
  }

  return { action: 'none' };
}

export function computeMoveIndex(tabs, tab, direction) {
  const { segmentStart, segmentEnd } = getSegmentBounds(tabs, tab);

  const currentIndex = tabs.findIndex((t) => t.id === tab.id);
  let newIndex = currentIndex + direction;

  if (newIndex < segmentStart) newIndex = segmentEnd;
  if (newIndex > segmentEnd) newIndex = segmentStart;

  return newIndex;
}

export function resolveTargetIndex(tab, tabs, targetIndex) {
  if (tab.groupId !== undefined && tab.groupId !== -1) {
    const groupTabs = tabs.filter((t) => t.groupId === tab.groupId);
    const groupIndices = groupTabs.map((t) => t.index);
    const minGroupIndex = Math.min(...groupIndices);
    const maxGroupIndex = Math.max(...groupIndices);
    return targetIndex <= 0 ? minGroupIndex : maxGroupIndex;
  }
  return targetIndex;
}
