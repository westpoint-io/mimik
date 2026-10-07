import { describe, expect, it } from 'vitest';
import type { Annotation, ScreenshotEdits } from '@/core/screenshot/types';
import { diffSnapshots, type SnapshotLike } from '../snapshot-diff';
import type { ScreenshotBounds, Snapshot } from '../types';

type StepInput = SnapshotLike['steps'][number];
type ShotInput = SnapshotLike['screenshots'][number];

function step(id: string, description = `${id} description`, screenshotId?: string, url?: string): StepInput {
  return { id, description, ...(screenshotId ? { screenshotId } : {}), ...(url ? { url } : {}) };
}

function shot(
  id: string,
  stepId: string,
  edits?: ScreenshotEdits,
  captured?: { bounds?: ScreenshotBounds; pixelRatio?: number },
): ShotInput & { stepId: string } {
  return { id, stepId, ...(edits ? { edits } : {}), ...captured };
}

function like(steps: StepInput[], overrides: Partial<SnapshotLike> = {}): SnapshotLike {
  return { title: 'Guide', stepIds: steps.map((s) => s.id), steps, screenshots: [], ...overrides };
}

const box: Annotation = { id: 'a1', type: 'box', x: 0, y: 0, w: 10, h: 10, color: '#000000' };
const otherBox: Annotation = { id: 'a1', type: 'box', x: 4, y: 4, w: 10, h: 10, color: '#000000' };
const arrow: Annotation = { id: 'a2', type: 'arrow', x1: 0, y1: 0, x2: 5, y2: 5, color: '#000000' };
const redact: Annotation = { id: 'r1', type: 'redact', x: 0, y: 0, w: 5, h: 5, style: 'blur' };
const otherRedact: Annotation = { id: 'r1', type: 'redact', x: 0, y: 0, w: 5, h: 5, style: 'solid' };

const empty = {
  titleChanged: false,
  added: 0,
  removed: 0,
  reordered: false,
  edited: 0,
  urls: 0,
  replaced: 0,
  cropped: 0,
  annotated: 0,
  blurred: 0,
  altEdited: false,
};

describe('diffSnapshots', () => {
  it('reports nothing for identical content', () => {
    const a = like([step('s1'), step('s2', 'second', 'sc1')], { screenshots: [shot('sc1', 's2')] });
    const b = like([step('s1'), step('s2', 'second', 'sc1')], { screenshots: [shot('sc1', 's2')] });

    expect(diffSnapshots(a, b)).toEqual(empty);
  });

  it('reports a title change', () => {
    const a = like([step('s1')], { title: 'Before' });
    const b = like([step('s1')], { title: 'After' });

    expect(diffSnapshots(a, b)).toEqual({ ...empty, titleChanged: true });
  });

  it('counts step ids present only in the newer side as added', () => {
    const a = like([step('s1')]);
    const b = like([step('s1'), step('s2'), step('s3')]);

    expect(diffSnapshots(a, b)).toEqual({ ...empty, added: 2 });
  });

  it('counts step ids present only in the older side as removed', () => {
    const a = like([step('s1'), step('s2'), step('s3')]);
    const b = like([step('s2')]);

    expect(diffSnapshots(a, b)).toEqual({ ...empty, removed: 2 });
  });

  it('compares step ids as sets, so a pure reorder adds and removes nothing', () => {
    const a = like([step('s1'), step('s2'), step('s3')]);
    const b = like([step('s3'), step('s2'), step('s1')]);

    expect(diffSnapshots(a, b)).toEqual({ ...empty, reordered: true });
  });

  it('does not report a reorder for a pure append', () => {
    const a = like([step('s1'), step('s2')]);
    const b = like([step('s1'), step('s2'), step('s3')]);

    expect(diffSnapshots(a, b)).toEqual({ ...empty, added: 1 });
  });

  it('does not report a reorder for an insert at the front', () => {
    const a = like([step('s1'), step('s2')]);
    const b = like([step('s3'), step('s1'), step('s2')]);

    expect(diffSnapshots(a, b)).toEqual({ ...empty, added: 1 });
  });

  it('does not report a reorder for a pure delete', () => {
    const a = like([step('s1'), step('s2'), step('s3')]);
    const b = like([step('s1'), step('s3')]);

    expect(diffSnapshots(a, b)).toEqual({ ...empty, removed: 1 });
  });

  it('does not report a reorder when a delete plus an add leaves survivors in order', () => {
    const a = like([step('s1'), step('s2'), step('s3')]);
    const b = like([step('s1'), step('s4'), step('s3'), step('s5')]);

    expect(diffSnapshots(a, b)).toEqual({ ...empty, added: 2, removed: 1 });
  });

  it('reports a reorder when survivors of a delete change relative order', () => {
    const a = like([step('s1'), step('s2'), step('s3')]);
    const b = like([step('s3'), step('s1')]);

    expect(diffSnapshots(a, b)).toEqual({ ...empty, removed: 1, reordered: true });
  });

  it('counts steps whose description changed as edited', () => {
    const a = like([step('s1', 'Old one'), step('s2', 'Old two'), step('s3', 'Same')]);
    const b = like([step('s1', 'New one'), step('s2', 'New two'), step('s3', 'Same')]);

    expect(diffSnapshots(a, b)).toEqual({ ...empty, edited: 2 });
  });

  it('does not count a removed step as edited', () => {
    const a = like([step('s1', 'Kept'), step('s2', 'Gone')]);
    const b = like([step('s1', 'Kept')]);

    expect(diffSnapshots(a, b)).toEqual({ ...empty, removed: 1 });
  });

  it('does not count an added step as edited', () => {
    const a = like([step('s1', 'Kept')]);
    const b = like([step('s1', 'Kept'), step('s2', 'Brand new')]);

    expect(diffSnapshots(a, b)).toEqual({ ...empty, added: 1 });
  });

  it('resolves surviving steps by id even when the steps array order differs', () => {
    const a = like([step('s1', 'One'), step('s2', 'Two')]);
    const b = { ...like([step('s1', 'One'), step('s2', 'Two')]), steps: [step('s2', 'Two'), step('s1', 'One')] };

    expect(diffSnapshots(a, b)).toEqual(empty);
  });

  it('counts steps whose url changed as link changes', () => {
    const a = like([
      step('s1', 'Same', undefined, 'https://a.test/one'),
      step('s2', 'Same', undefined, 'https://a.test/two'),
    ]);
    const b = like([
      step('s1', 'Same', undefined, 'https://b.test/one'),
      step('s2', 'Same', undefined, 'https://a.test/two'),
    ]);

    expect(diffSnapshots(a, b)).toEqual({ ...empty, urls: 1 });
  });

  it('does not count a description change as a link change', () => {
    const a = like([step('s1', 'Old', undefined, 'https://a.test')]);
    const b = like([step('s1', 'New', undefined, 'https://a.test')]);

    expect(diffSnapshots(a, b)).toEqual({ ...empty, edited: 1 });
  });

  it('does not count a link change as a description change', () => {
    const a = like([step('s1', 'Same', undefined, 'https://a.test')]);
    const b = like([step('s1', 'Same', undefined, 'https://b.test')]);

    expect(diffSnapshots(a, b)).toEqual({ ...empty, urls: 1 });
  });

  it('counts a repointed screenshot as replaced', () => {
    const a = like([step('s1', 'Same', 'sc1')], { screenshots: [shot('sc1', 's1')] });
    const b = like([step('s1', 'Same', 'sc2')], { screenshots: [shot('sc1', 's1'), shot('sc2', 's1')] });

    expect(diffSnapshots(a, b)).toEqual({ ...empty, replaced: 1 });
  });

  it('counts a deleted screenshot as replaced', () => {
    const a = like([step('s1', 'Same', 'sc1')], { screenshots: [shot('sc1', 's1')] });
    const b = like([step('s1', 'Same')], { screenshots: [shot('sc1', 's1')] });

    expect(diffSnapshots(a, b)).toEqual({ ...empty, replaced: 1 });
  });

  it('counts a newly attached screenshot as replaced', () => {
    const a = like([step('s1', 'Same')], { screenshots: [] });
    const b = like([step('s1', 'Same', 'sc1')], { screenshots: [shot('sc1', 's1')] });

    expect(diffSnapshots(a, b)).toEqual({ ...empty, replaced: 1 });
  });

  it('does not count an edits-only change as replaced', () => {
    const a = like([step('s1', 'Same', 'sc1')], { screenshots: [shot('sc1', 's1', { annotations: [box] })] });
    const b = like([step('s1', 'Same', 'sc1')], { screenshots: [shot('sc1', 's1', { annotations: [otherBox] })] });

    expect(diffSnapshots(a, b)).toEqual({ ...empty, annotated: 1 });
  });

  it('counts a changed viewport as cropped', () => {
    const a = like([step('s1', 'Same', 'sc1')], {
      screenshots: [shot('sc1', 's1', { viewport: { x: 0, y: 0, width: 100, height: 50 } })],
    });
    const b = like([step('s1', 'Same', 'sc1')], {
      screenshots: [shot('sc1', 's1', { viewport: { x: 10, y: 0, width: 80, height: 50 } })],
    });

    expect(diffSnapshots(a, b)).toEqual({ ...empty, cropped: 1 });
  });

  it('does not count a zoom change as cropped', () => {
    const a = like([step('s1', 'Same', 'sc1')], {
      screenshots: [shot('sc1', 's1', { zoomLevel: 1, viewport: { x: 0, y: 0, width: 100, height: 50 } })],
    });
    const b = like([step('s1', 'Same', 'sc1')], {
      screenshots: [shot('sc1', 's1', { zoomLevel: 2, viewport: { x: 25, y: 12, width: 50, height: 25 } })],
    });

    expect(diffSnapshots(a, b)).toEqual(empty);
  });

  it('counts a hand crop over an app-set zoom as cropped', () => {
    const a = like([step('s1', 'Same', 'sc1')], {
      screenshots: [shot('sc1', 's1', { zoomLevel: 1, viewport: { x: 0, y: 0, width: 100, height: 50 } })],
    });
    const b = like([step('s1', 'Same', 'sc1')], {
      screenshots: [shot('sc1', 's1', { viewport: { x: 10, y: 0, width: 80, height: 50 } })],
    });

    expect(diffSnapshots(a, b)).toEqual({ ...empty, cropped: 1 });
  });

  it('does not count an annotation change as cropped', () => {
    const a = like([step('s1', 'Same', 'sc1')], {
      screenshots: [shot('sc1', 's1', { viewport: { x: 0, y: 0, width: 100, height: 50 }, annotations: [box] })],
    });
    const b = like([step('s1', 'Same', 'sc1')], {
      screenshots: [shot('sc1', 's1', { viewport: { x: 0, y: 0, width: 100, height: 50 }, annotations: [otherBox] })],
    });

    expect(diffSnapshots(a, b)).toEqual({ ...empty, annotated: 1 });
  });

  it('counts changed non-redact annotations as annotated', () => {
    const a = like([step('s1', 'Same', 'sc1')], { screenshots: [shot('sc1', 's1', { annotations: [box] })] });
    const b = like([step('s1', 'Same', 'sc1')], { screenshots: [shot('sc1', 's1', { annotations: [box, arrow] })] });

    expect(diffSnapshots(a, b)).toEqual({ ...empty, annotated: 1 });
  });

  it('counts reordered annotations as annotated', () => {
    const a = like([step('s1', 'Same', 'sc1')], { screenshots: [shot('sc1', 's1', { annotations: [box, arrow] })] });
    const b = like([step('s1', 'Same', 'sc1')], { screenshots: [shot('sc1', 's1', { annotations: [arrow, box] })] });

    expect(diffSnapshots(a, b)).toEqual({ ...empty, annotated: 1 });
  });

  it('counts a changed click target as annotated', () => {
    const a = like([step('s1', 'Same', 'sc1')], {
      screenshots: [
        shot('sc1', 's1', { target: { x: 1, y: 2, width: 3, height: 4, border: 'dashed', color: '#4F46E5' } }),
      ],
    });
    const b = like([step('s1', 'Same', 'sc1')], {
      screenshots: [
        shot('sc1', 's1', { target: { x: 1, y: 2, width: 3, height: 4, border: 'solid', color: '#4F46E5' } }),
      ],
    });

    expect(diffSnapshots(a, b)).toEqual({ ...empty, annotated: 1 });
  });

  it('does not count a redact change as annotated', () => {
    const a = like([step('s1', 'Same', 'sc1')], { screenshots: [shot('sc1', 's1', { annotations: [box, redact] })] });
    const b = like([step('s1', 'Same', 'sc1')], {
      screenshots: [shot('sc1', 's1', { annotations: [box, otherRedact] })],
    });

    expect(diffSnapshots(a, b)).toEqual({ ...empty, blurred: 1 });
  });

  it('counts changed redact annotations as blurred', () => {
    const a = like([step('s1', 'Same', 'sc1')], { screenshots: [shot('sc1', 's1', { annotations: [] })] });
    const b = like([step('s1', 'Same', 'sc1')], { screenshots: [shot('sc1', 's1', { annotations: [redact] })] });

    expect(diffSnapshots(a, b)).toEqual({ ...empty, blurred: 1 });
  });

  it('does not count a non-redact change as blurred', () => {
    const a = like([step('s1', 'Same', 'sc1')], { screenshots: [shot('sc1', 's1', { annotations: [redact, box] })] });
    const b = like([step('s1', 'Same', 'sc1')], {
      screenshots: [shot('sc1', 's1', { annotations: [redact, otherBox] })],
    });

    expect(diffSnapshots(a, b)).toEqual({ ...empty, annotated: 1 });
  });

  it('reports annotated and blurred separately when both partitions changed', () => {
    const a = like([step('s1', 'Same', 'sc1')], { screenshots: [shot('sc1', 's1', { annotations: [box, redact] })] });
    const b = like([step('s1', 'Same', 'sc1')], {
      screenshots: [shot('sc1', 's1', { annotations: [otherBox, otherRedact] })],
    });

    expect(diffSnapshots(a, b)).toEqual({ ...empty, annotated: 1, blurred: 1 });
  });

  it('ignores where a redact sits in the annotations array relative to other annotations', () => {
    const a = like([step('s1', 'Same', 'sc1')], { screenshots: [shot('sc1', 's1', { annotations: [redact, box] })] });
    const b = like([step('s1', 'Same', 'sc1')], { screenshots: [shot('sc1', 's1', { annotations: [box, redact] })] });

    expect(diffSnapshots(a, b)).toEqual(empty);
  });

  it('reports a changed alt text as a single boolean, not a count', () => {
    const a = like([step('s1', 'Same', 'sc1'), step('s2', 'Same', 'sc2')], {
      screenshots: [shot('sc1', 's1', { alt: 'one' }), shot('sc2', 's2', { alt: 'two' })],
    });
    const b = like([step('s1', 'Same', 'sc1'), step('s2', 'Same', 'sc2')], {
      screenshots: [shot('sc1', 's1', { alt: 'ONE' }), shot('sc2', 's2', { alt: 'TWO' })],
    });

    expect(diffSnapshots(a, b)).toEqual({ ...empty, altEdited: true });
  });

  it('does not report an alt change when only the annotations moved', () => {
    const a = like([step('s1', 'Same', 'sc1')], {
      screenshots: [shot('sc1', 's1', { alt: 'same', annotations: [box] })],
    });
    const b = like([step('s1', 'Same', 'sc1')], {
      screenshots: [shot('sc1', 's1', { alt: 'same', annotations: [otherBox] })],
    });

    expect(diffSnapshots(a, b)).toEqual({ ...empty, annotated: 1 });
  });

  it('treats absent edits and empty edits as the same', () => {
    const a = like([step('s1', 'Same', 'sc1')], { screenshots: [shot('sc1', 's1')] });
    const b = like([step('s1', 'Same', 'sc1')], { screenshots: [shot('sc1', 's1', {})] });

    expect(diffSnapshots(a, b)).toEqual(empty);
  });

  it('ignores the key order of the edits object', () => {
    const before: ScreenshotEdits = {
      viewport: { x: 0, y: 0, width: 10, height: 10 },
      alt: 'a',
      annotations: [box],
      target: null,
    };
    const after: ScreenshotEdits = { ...before, target: null };
    delete after.viewport;
    delete after.alt;
    const rebuilt: ScreenshotEdits = { target: null, annotations: [box] };

    expect(JSON.stringify(after)).not.toBe(JSON.stringify(rebuilt));

    const a = like([step('s1', 'Same', 'sc1')], { screenshots: [shot('sc1', 's1', after)] });
    const b = like([step('s1', 'Same', 'sc1')], { screenshots: [shot('sc1', 's1', rebuilt)] });

    expect(diffSnapshots(a, b)).toEqual(empty);
  });

  it('ignores the key order of nested annotation objects', () => {
    const a = like([step('s1', 'Same', 'sc1')], {
      screenshots: [
        shot('sc1', 's1', { annotations: [{ id: 'a1', type: 'box', x: 0, y: 0, w: 1, h: 1, color: '#000' }] }),
      ],
    });
    const b = like([step('s1', 'Same', 'sc1')], {
      screenshots: [
        shot('sc1', 's1', { annotations: [{ color: '#000', h: 1, w: 1, y: 0, x: 0, type: 'box', id: 'a1' }] }),
      ],
    });

    expect(diffSnapshots(a, b)).toEqual(empty);
  });

  it('resolves the screenshot through the step pointer, not by stepId', () => {
    const a = like([step('s1', 'Same', 'sc2')], {
      screenshots: [shot('sc1', 's1', { alt: 'stale row' }), shot('sc2', 's1', { alt: 'live row' })],
    });
    const b = like([step('s1', 'Same', 'sc2')], {
      screenshots: [shot('sc1', 's1', { alt: 'stale row changed' }), shot('sc2', 's1', { alt: 'live row' })],
    });

    expect(diffSnapshots(a, b)).toEqual(empty);
  });

  it('resolves screenshot rows by id even when the screenshots array order differs', () => {
    const a = like([step('s1', 'Same', 'sc1'), step('s2', 'Same', 'sc2')], {
      screenshots: [shot('sc1', 's1', { alt: 'one' }), shot('sc2', 's2', { alt: 'two' })],
    });
    const b = like([step('s1', 'Same', 'sc1'), step('s2', 'Same', 'sc2')], {
      screenshots: [shot('sc2', 's2', { alt: 'two' }), shot('sc1', 's1', { alt: 'one' })],
    });

    expect(diffSnapshots(a, b)).toEqual(empty);
  });

  it('does not report the edits left behind on the row a replacement replaced', () => {
    const a = like([step('s1', 'Same', 'sc1')], { screenshots: [shot('sc1', 's1', { alt: 'one' })] });
    const b = like([step('s1', 'Same', 'sc2')], {
      screenshots: [shot('sc1', 's1', { alt: 'one' }), shot('sc2', 's1', { alt: 'two' })],
    });

    expect(diffSnapshots(a, b)).toEqual({ ...empty, replaced: 1 });
  });

  it('reports only the replacement when a pristine screenshot is replaced', () => {
    const a = like([step('s1', 'Same', 'old')], {
      screenshots: [shot('old', 's1', undefined, { bounds: { x: 2, y: 3, width: 4, height: 5 }, pixelRatio: 2 })],
    });
    const b = like([step('s1', 'Same', 'new')], {
      screenshots: [
        shot('old', 's1', undefined, { bounds: { x: 2, y: 3, width: 4, height: 5 }, pixelRatio: 2 }),
        shot('new', 's1', { target: null }),
      ],
    });

    expect(diffSnapshots(a, b)).toEqual({ ...empty, replaced: 1 });
  });

  it('reports only the replacement when a fully edited screenshot is replaced', () => {
    const edited: ScreenshotEdits = {
      viewport: { x: 1, y: 2, width: 30, height: 40 },
      target: { x: 0, y: 0, width: 5, height: 5, border: 'dashed', color: '#4F46E5' },
      annotations: [box, redact],
      alt: 'hello',
    };
    const carried: ScreenshotEdits = { ...edited, target: null };
    delete carried.viewport;
    delete carried.alt;

    const a = like([step('s1', 'Same', 'old')], { screenshots: [shot('old', 's1', edited)] });
    const b = like([step('s1', 'Same', 'new')], {
      screenshots: [shot('old', 's1', edited), shot('new', 's1', carried)],
    });

    expect(diffSnapshots(a, b)).toEqual({ ...empty, replaced: 1 });
  });

  it('suppresses the derived causes per step, not per diff', () => {
    const a = like([step('r1', 'Same', 'old'), step('c1', 'Same', 'kept')], {
      screenshots: [
        shot('old', 'r1', { alt: 'gone' }),
        shot('kept', 'c1', { viewport: { x: 0, y: 0, width: 9, height: 9 } }),
      ],
    });
    const b = like([step('r1', 'Same', 'new'), step('c1', 'Same', 'kept')], {
      screenshots: [
        shot('new', 'r1', { target: null }),
        shot('kept', 'c1', { viewport: { x: 3, y: 0, width: 6, height: 9 } }),
      ],
    });

    expect(diffSnapshots(a, b)).toEqual({ ...empty, replaced: 1, cropped: 1 });
  });

  it('lets a step other than the replaced one set the alt flag', () => {
    const a = like([step('r1', 'Same', 'old'), step('t1', 'Same', 'text')], {
      screenshots: [shot('old', 'r1', { alt: 'gone' }), shot('text', 't1', { alt: 'before' })],
    });
    const b = like([step('r1', 'Same', 'new'), step('t1', 'Same', 'text')], {
      screenshots: [shot('new', 'r1', { target: null }), shot('text', 't1', { alt: 'after' })],
    });

    expect(diffSnapshots(a, b)).toEqual({ ...empty, replaced: 1, altEdited: true });
  });

  it('reports nothing for an annotation editor visit that materialised the derived target', () => {
    const captured = { bounds: { x: 2, y: 3, width: 4, height: 5 }, pixelRatio: 2 };
    const a = like([step('s1', 'Same', 'sc1')], { screenshots: [shot('sc1', 's1', undefined, captured)] });
    const b = like([step('s1', 'Same', 'sc1')], {
      screenshots: [
        shot(
          'sc1',
          's1',
          {
            annotations: [],
            target: { x: 4, y: 6, width: 8, height: 10, border: 'dashed', color: '#4F46E5' },
          },
          captured,
        ),
      ],
    });

    expect(diffSnapshots(a, b)).toEqual(empty);
  });

  it('reports nothing when an absent target and an explicit null both resolve to no target', () => {
    const a = like([step('s1', 'Same', 'sc1')], { screenshots: [shot('sc1', 's1')] });
    const b = like([step('s1', 'Same', 'sc1')], { screenshots: [shot('sc1', 's1', { target: null })] });

    expect(diffSnapshots(a, b)).toEqual(empty);
  });

  it('still reports a target the user actually moved away from the derived box', () => {
    const captured = { bounds: { x: 2, y: 3, width: 4, height: 5 }, pixelRatio: 2 };
    const a = like([step('s1', 'Same', 'sc1')], { screenshots: [shot('sc1', 's1', undefined, captured)] });
    const b = like([step('s1', 'Same', 'sc1')], {
      screenshots: [
        shot(
          'sc1',
          's1',
          { target: { x: 40, y: 6, width: 8, height: 10, border: 'dashed', color: '#4F46E5' } },
          captured,
        ),
      ],
    });

    expect(diffSnapshots(a, b)).toEqual({ ...empty, annotated: 1 });
  });

  it('still reports a target the user switched off', () => {
    const captured = { bounds: { x: 2, y: 3, width: 4, height: 5 }, pixelRatio: 2 };
    const a = like([step('s1', 'Same', 'sc1')], { screenshots: [shot('sc1', 's1', undefined, captured)] });
    const b = like([step('s1', 'Same', 'sc1')], { screenshots: [shot('sc1', 's1', { target: null }, captured)] });

    expect(diffSnapshots(a, b)).toEqual({ ...empty, annotated: 1 });
  });

  it('treats an empty alt string as no alt text', () => {
    const a = like([step('s1', 'Same', 'sc1')], { screenshots: [shot('sc1', 's1')] });
    const b = like([step('s1', 'Same', 'sc1')], { screenshots: [shot('sc1', 's1', { alt: '' })] });

    expect(diffSnapshots(a, b)).toEqual(empty);
  });

  it('reports clearing an alt text that was really there', () => {
    const a = like([step('s1', 'Same', 'sc1')], { screenshots: [shot('sc1', 's1', { alt: 'described' })] });
    const b = like([step('s1', 'Same', 'sc1')], { screenshots: [shot('sc1', 's1', { alt: '' })] });

    expect(diffSnapshots(a, b)).toEqual({ ...empty, altEdited: true });
  });

  it('ignores screenshots belonging to steps present on only one side', () => {
    const a = like([step('s1', 'Same'), step('s2', 'Gone', 'sc1')], { screenshots: [shot('sc1', 's2')] });
    const b = like([step('s1', 'Same'), step('s3', 'New', 'sc2')], { screenshots: [shot('sc2', 's3')] });

    expect(diffSnapshots(a, b)).toEqual({ ...empty, added: 1, removed: 1 });
  });

  it('reports every dimension at once', () => {
    const a = like(
      [
        step('s1', 'Gone'),
        step('s3', 'Old three'),
        step('s4', 'Same', undefined, 'https://a.test'),
        step('s5', 'Same', 'sc5a'),
        step('s6', 'Same', 'sc6'),
        step('s7', 'Same', 'sc7'),
        step('s8', 'Same', 'sc8'),
        step('s9', 'Same', 'sc9'),
      ],
      {
        title: 'Before',
        screenshots: [
          shot('sc5a', 's5'),
          shot('sc6', 's6', { viewport: { x: 0, y: 0, width: 100, height: 50 } }),
          shot('sc7', 's7', { annotations: [box] }),
          shot('sc8', 's8', { annotations: [redact] }),
          shot('sc9', 's9', { alt: 'before' }),
        ],
      },
    );
    const b = like(
      [
        step('s2', 'New'),
        step('s4', 'Same', undefined, 'https://b.test'),
        step('s3', 'New three'),
        step('s5', 'Same', 'sc5b'),
        step('s6', 'Same', 'sc6'),
        step('s7', 'Same', 'sc7'),
        step('s8', 'Same', 'sc8'),
        step('s9', 'Same', 'sc9'),
      ],
      {
        title: 'After',
        screenshots: [
          shot('sc5b', 's5'),
          shot('sc6', 's6', { viewport: { x: 5, y: 0, width: 90, height: 50 } }),
          shot('sc7', 's7', { annotations: [otherBox] }),
          shot('sc8', 's8', { annotations: [otherRedact] }),
          shot('sc9', 's9', { alt: 'after' }),
        ],
      },
    );

    expect(diffSnapshots(a, b)).toEqual({
      titleChanged: true,
      added: 1,
      removed: 1,
      reordered: true,
      edited: 1,
      urls: 1,
      replaced: 1,
      cropped: 1,
      annotated: 1,
      blurred: 1,
      altEdited: true,
    });
  });

  it('accepts full Snapshot records on both sides', () => {
    const base: Snapshot = {
      id: 'n1',
      guideId: 'g1',
      createdAt: 1,
      contentHash: 'h1',
      title: 'Guide',
      stepIds: ['s1'],
      steps: [
        {
          id: 's1',
          guideId: 'g1',
          index: 0,
          description: 'Click it',
          action: 'click',
          url: 'https://example.com',
          timestamp: 1,
          screenshotId: 'sc1',
        },
      ],
      screenshots: [{ id: 'sc1', stepId: 's1', mimeType: 'image/png', width: 10, height: 10 }],
    };
    const next: Snapshot = { ...base, id: 'n2', title: 'Guide renamed' };

    expect(diffSnapshots(base, next)).toEqual({ ...empty, titleChanged: true });
  });
});
