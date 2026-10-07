// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { PanelVoiceUpdate } from '@/lib/port/types';

vi.mock('../MicMeter', () => ({ MicMeter: () => null }));

import { VoiceStatus } from '../VoiceStatus';

const idle: PanelVoiceUpdate = { type: 'VOICE_UPDATE', phase: 'idle' };

describe('the narration line under a paused recording', () => {
  it('says narration is paused, not that it starts with the next recording', () => {
    render(<VoiceStatus update={idle} enabled paused />);

    expect(screen.getByText('voice.pausedWithCapture')).toBeTruthy();
    expect(screen.queryByText('voice.nextRecording')).toBeNull();
  });

  it('still promises the next recording when capture is not paused', () => {
    render(<VoiceStatus update={idle} enabled />);

    expect(screen.getByText('voice.nextRecording')).toBeTruthy();
    expect(screen.queryByText('voice.pausedWithCapture')).toBeNull();
  });

  it('says nothing at all when narration is switched off', () => {
    const { container } = render(<VoiceStatus update={idle} enabled={false} paused />);

    expect(container.textContent).toBe('');
  });
});
