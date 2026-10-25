import { describe, it, expect } from 'vitest';
import {
  getSegmentBounds,
  computeMoveIndex,
  resolveTargetIndex,
  resolveGroupAfterMove,
} from './segment.js';

const makeTabs = (entries) =>
  entries.map(({ index, pinned = false, groupId = -1, id }) => ({
    index,
    pinned,
    groupId,
    id,
  }));

describe('getSegmentBounds', () => {
  it('returns window bounds for an ungrouped unpinned tab', () => {
    const tabs = makeTabs([
      { index: 0, id: 'a' }, // ['a']
      { index: 1, id: 'b' }, // ['a', 'b']
      { index: 2, id: 'c' }, // ['a', 'b', 'c']
    ]);
    expect(getSegmentBounds(tabs, tabs[1])).toEqual({ segmentStart: 0, segmentEnd: 2 });
  });

  it('respects pinned segment for a pinned tab', () => {
    const tabs = makeTabs([
      { index: 0, pinned: true, id: 'p1' },
      { index: 1, pinned: true, id: 'p2' },
      { index: 2, id: 'a' },
      { index: 3, id: 'b' },
    ]);
    expect(getSegmentBounds(tabs, tabs[0])).toEqual({ segmentStart: 0, segmentEnd: 1 });
  });

  it('respects unpinned segment for an unpinned tab with pinned tabs', () => {
    const tabs = makeTabs([
      { index: 0, pinned: true, id: 'p1' },
      { index: 1, pinned: true, id: 'p2' },
      { index: 2, id: 'a' },
      { index: 3, id: 'b' },
    ]);
    expect(getSegmentBounds(tabs, tabs[2])).toEqual({ segmentStart: 2, segmentEnd: 3 });
  });
});

describe('computeMoveIndex', () => {
  it('moves one position right within an ungrouped tab strip', () => {
    const tabs = makeTabs([
      { index: 0, id: 'a' },
      { index: 1, id: 'b' },
      { index: 2, id: 'c' },
    ]);
    expect(computeMoveIndex(tabs, tabs[1], 1)).toBe(2);
  });

  it('moves one position left within an ungrouped tab strip', () => {
    const tabs = makeTabs([
      { index: 0, id: 'a' },
      { index: 1, id: 'b' },
      { index: 2, id: 'c' },
    ]);
    expect(computeMoveIndex(tabs, tabs[1], -1)).toBe(0);
  });

  it('wraps right from end to start of ungrouped strip', () => {
    const tabs = makeTabs([
      { index: 0, id: 'a' },
      { index: 1, id: 'b' },
      { index: 2, id: 'c' },
    ]);
    expect(computeMoveIndex(tabs, tabs[2], 1)).toBe(0);
  });

  it('wraps left from start to end of ungrouped strip', () => {
    const tabs = makeTabs([
      { index: 0, id: 'a' },
      { index: 1, id: 'b' },
      { index: 2, id: 'c' },
    ]);
    expect(computeMoveIndex(tabs, tabs[0], -1)).toBe(2);
  });

  it('steps out of a group to the next group instead of wrapping inside it', () => {
    const tabs = makeTabs([
      { index: 0, id: 'a', groupId: -1 },
      { index: 1, id: 'b', groupId: 1 },
      { index: 2, id: 'c', groupId: 1 },
      { index: 3, id: 'd', groupId: 1 },
      { index: 4, id: 'e', groupId: 2 },
    ]);
    expect(computeMoveIndex(tabs, tabs[3], 1)).toBe(4);
  });

  it('steps out of a group to the left instead of wrapping inside it', () => {
    const tabs = makeTabs([
      { index: 0, id: 'a', groupId: -1 },
      { index: 1, id: 'b', groupId: 1 },
      { index: 2, id: 'c', groupId: 1 },
      { index: 3, id: 'd', groupId: 1 },
      { index: 4, id: 'e', groupId: 2 },
    ]);
    expect(computeMoveIndex(tabs, tabs[1], -1)).toBe(0);
  });

  it('crosses group boundaries when group is in the middle of the window', () => {
    const tabs = makeTabs([
      { index: 0, id: 'a', groupId: -1 },
      { index: 1, id: 'b', groupId: 1 },
      { index: 2, id: 'c', groupId: 1 },
      { index: 3, id: 'd', groupId: 1 },
      { index: 4, id: 'e', groupId: -1 },
    ]);
    expect(computeMoveIndex(tabs, tabs[3], 1)).toBe(4);
    expect(computeMoveIndex(tabs, tabs[1], -1)).toBe(0);
  });

  it('stays within pinned segment', () => {
    const tabs = makeTabs([
      { index: 0, pinned: true, id: 'p1' },
      { index: 1, pinned: true, id: 'p2' },
      { index: 2, id: 'a' },
      { index: 3, id: 'b' },
    ]);
    expect(computeMoveIndex(tabs, tabs[0], -1)).toBe(1);
    expect(computeMoveIndex(tabs, tabs[1], 1)).toBe(0);
  });
});

describe('resolveTargetIndex', () => {
  it('returns target index as-is for ungrouped tab', () => {
    const tabs = makeTabs([
      { index: 0, id: 'a' },
      { index: 1, id: 'b' },
    ]);
    expect(resolveTargetIndex(tabs[0], tabs, 0)).toBe(0);
    expect(resolveTargetIndex(tabs[1], tabs, 1)).toBe(1);
  });

  it('maps first-target to group start', () => {
    const tabs = makeTabs([
      { index: 0, id: 'a', groupId: -1 },
      { index: 2, id: 'b', groupId: 1 },
      { index: 3, id: 'c', groupId: 1 },
      { index: 4, id: 'd', groupId: 1 },
      { index: 5, id: 'e', groupId: -1 },
    ]);
    expect(resolveTargetIndex(tabs[2], tabs, 0)).toBe(2);
  });

  it('maps last-target to group end', () => {
    const tabs = makeTabs([
      { index: 0, id: 'a', groupId: -1 },
      { index: 2, id: 'b', groupId: 1 },
      { index: 3, id: 'c', groupId: 1 },
      { index: 4, id: 'd', groupId: 1 },
      { index: 5, id: 'e', groupId: -1 },
    ]);
    expect(resolveTargetIndex(tabs[2], tabs, 4)).toBe(4);
  });

  it('returns target index as-is when tab has no group', () => {
    const tabs = makeTabs([
      { index: 0, id: 'a' },
      { index: 1, id: 'b' },
    ]);
    expect(resolveTargetIndex(tabs[0], tabs, 1)).toBe(1);
  });
});

describe('resolveGroupAfterMove', () => {
  const tab = (id, groupId = -1) => ({ id, groupId, pinned: false });

  it('keeps a grouped tab in its group when landing on the last slot', () => {
    const another = 1;
    const extensions = 2;
    expect(
      resolveGroupAfterMove(
        another,
        tab('c', another),
        tab('ext', extensions),
        1
      )
    ).toEqual({ action: 'join', groupId: another });
  });

  it('keeps a grouped tab in its group when landing on the first slot', () => {
    const another = 1;
    const extensions = 2;
    expect(
      resolveGroupAfterMove(
        another,
        tab('ext', extensions),
        tab('b', another),
        -1
      )
    ).toEqual({ action: 'join', groupId: another });
  });

  it('moves a grouped tab into the next group when fully past its boundary', () => {
    const another = 1;
    const extensions = 2;
    expect(
      resolveGroupAfterMove(
        another,
        tab('ext', extensions),
        tab('ext2', extensions),
        1
      )
    ).toEqual({ action: 'join', groupId: extensions });
  });

  it('joins an ungrouped tab to a neighboring group', () => {
    const another = 1;
    expect(
      resolveGroupAfterMove(null, tab('a', another), tab('b', another), 1)
    ).toEqual({ action: 'join', groupId: another });
  });
});