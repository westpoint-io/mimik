import * as OpenCC from 'opencc-js';
import { describe, expect, it } from 'vitest';
import { localeKeys, localeMessage } from './read-locale';

const toTraditional = OpenCC.Converter({ from: 'cn', to: 'tw' });

const SHARED_IN_TAIWAN = new Set([...'台里干后准范冲云余只并采征板价适叶柜洒踪杰']);

function simplifiedIn(text: string): string[] {
  return [...text].filter((char) => !SHARED_IN_TAIWAN.has(char) && toTraditional(char) !== char);
}

describe('Traditional Chinese', () => {
  it('uses no Simplified characters', () => {
    const found = localeKeys('zh-TW').flatMap((key) => {
      const chars = simplifiedIn(localeMessage('zh-TW', key));
      return chars.length > 0 ? [`${key}: ${chars.join('')}`] : [];
    });
    expect(found).toEqual([]);
  });

  it('catches Simplified characters and leaves standard Taiwan wording alone', () => {
    expect(simplifiedIn('导出视频')).toEqual(['导', '视', '频']);
    expect(simplifiedIn('匯出影片到儀表板，散布到這台裝置')).toEqual([]);
  });
});
