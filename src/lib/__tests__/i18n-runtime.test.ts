import { describe, expect, it } from 'vitest';
import { i18n } from '#imports';
import { setDisplayLocale } from '../i18n-runtime';

const t = i18n.t as unknown as (key: string, substitutions?: string[]) => string;

describe('i18n runtime', () => {
  it('translates WXT-style underscore keys for app-selected locales', () => {
    setDisplayLocale('zh-CN');

    expect(t('fullview_allGuides')).toBe('全部指南');
    expect(t('library_noGuidesTitle')).toBe('暂无指南');
    expect(t('library_noGuidesSub')).toBe('开始捕获，创建你的第一份指南');
    expect(t('sort_mostSteps')).toBe('步骤最多');
  });

  it('keeps dotted keys working for app-selected locales', () => {
    setDisplayLocale('zh-CN');

    expect(t('fullview.allGuides')).toBe('全部指南');
  });

  it('falls back to the native translator when no app locale is selected', () => {
    setDisplayLocale(undefined);

    expect(t('fullview_allGuides')).toBe('fullview_allGuides');
  });
});
