// @vitest-environment jsdom

import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useVideoElement } from '../use-video-element';

afterEach(() => vi.restoreAllMocks());

describe('useVideoElement', () => {
  function Player() {
    const player = useVideoElement(false);
    return (
      <>
        <video ref={player.video} {...player.events}>
          <track kind="captions" />
        </video>
        <output>{player.duration}</output>
      </>
    );
  }

  it('reads a duration the video already knew before the player mounted', () => {
    vi.spyOn(HTMLMediaElement.prototype, 'duration', 'get').mockReturnValue(46);
    render(<Player />);
    expect(screen.getByRole('status').textContent).toBe('46');
  });

  it('follows the duration when it changes later', () => {
    const duration = vi.spyOn(HTMLMediaElement.prototype, 'duration', 'get').mockReturnValue(Number.NaN);
    const { container } = render(<Player />);
    duration.mockReturnValue(12);
    act(() => {
      container.querySelector('video')?.dispatchEvent(new Event('durationchange'));
    });
    expect(screen.getByRole('status').textContent).toBe('12');
  });
});
