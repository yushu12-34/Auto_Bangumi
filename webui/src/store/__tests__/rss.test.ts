import { describe, expect, it } from 'vitest';
import type { RSSRefreshAllResult } from '#/api';
import type { RSS } from '#/rss';
import { buildRefreshAllFeedback, sortRSSList } from '@/store/rss';

const translations = {
  'rss.refresh_summary_empty_title': 'No RSS Sources',
  'rss.refresh_summary_empty_message': 'There are no enabled RSS sources to refresh.',
  'rss.refresh_summary_success_title': 'Refresh Completed',
  'rss.refresh_summary_success_message':
    'Refreshed {count} RSS source(s) successfully.',
  'rss.refresh_summary_failure_title': 'Refresh Failed',
  'rss.refresh_summary_failure_message':
    'All {total} RSS source(s) failed to refresh.',
  'rss.refresh_summary_partial_title': 'Refresh Completed with Failures',
  'rss.refresh_summary_partial_message':
    'Refreshed {success} of {total} RSS source(s). {failed} failed.',
} as const;

function t(key: string, params?: Record<string, number | string>) {
  let value: string = translations[key as keyof typeof translations] ?? key;
  if (!params) return value;
  for (const [paramKey, paramValue] of Object.entries(params)) {
    value = value.replace(`{${paramKey}}`, String(paramValue));
  }
  return value;
}

describe('RSS Store Logic', () => {
  describe('sortRSSList', () => {
    it('should sort enabled feeds first then by id descending', () => {
      const mixedList = [
        { id: 1, name: 'Feed 1', url: 'url1', enabled: false },
        { id: 2, name: 'Feed 2', url: 'url2', enabled: true },
        { id: 3, name: 'Feed 3', url: 'url3', enabled: false },
        { id: 4, name: 'Feed 4', url: 'url4', enabled: true },
      ] as RSS[];

      const sorted = sortRSSList(mixedList);

      expect(sorted.map((item) => item.id)).toEqual([4, 2, 3, 1]);
    });

    it('should handle empty list', () => {
      expect(sortRSSList([])).toEqual([]);
    });
  });

  describe('buildRefreshAllFeedback', () => {
    it('should return success feedback when all RSS succeed', () => {
      const result: RSSRefreshAllResult = {
        total: 2,
        success_count: 2,
        failed_count: 0,
        items: [
          { rss_id: 1, rss_name: 'Feed 1', success: true, message: 'ok' },
          { rss_id: 2, rss_name: 'Feed 2', success: true, message: 'ok' },
        ],
      };

      const feedback = buildRefreshAllFeedback(result, t);

      expect(feedback.type).toBe('success');
      expect(feedback.title).toBe('Refresh Completed');
      expect(feedback.message).toBe('Refreshed 2 RSS source(s) successfully.');
      expect(feedback.failedItems).toEqual([]);
    });

    it('should return warning feedback with failed RSS details on partial failure', () => {
      const result: RSSRefreshAllResult = {
        total: 3,
        success_count: 2,
        failed_count: 1,
        items: [
          { rss_id: 1, rss_name: 'Feed 1', success: true, message: 'ok' },
          {
            rss_id: 2,
            rss_name: 'Feed 2',
            success: false,
            message: 'Connect timeout',
          },
          { rss_id: 3, rss_name: 'Feed 3', success: true, message: 'ok' },
        ],
      };

      const feedback = buildRefreshAllFeedback(result, t);

      expect(feedback.type).toBe('warning');
      expect(feedback.title).toBe('Refresh Completed with Failures');
      expect(feedback.message).toBe('Refreshed 2 of 3 RSS source(s). 1 failed.');
      expect(feedback.failedItems).toEqual([
        {
          rss_id: 2,
          rss_name: 'Feed 2',
          success: false,
          message: 'Connect timeout',
        },
      ]);
    });

    it('should return error feedback when all RSS fail', () => {
      const result: RSSRefreshAllResult = {
        total: 2,
        success_count: 0,
        failed_count: 2,
        items: [
          { rss_id: 1, rss_name: 'Feed 1', success: false, message: '403' },
          { rss_id: 2, rss_name: 'Feed 2', success: false, message: '500' },
        ],
      };

      const feedback = buildRefreshAllFeedback(result, t);

      expect(feedback.type).toBe('error');
      expect(feedback.title).toBe('Refresh Failed');
      expect(feedback.message).toBe('All 2 RSS source(s) failed to refresh.');
      expect(feedback.failedItems).toHaveLength(2);
    });

    it('should return info feedback when there are no RSS sources', () => {
      const result: RSSRefreshAllResult = {
        total: 0,
        success_count: 0,
        failed_count: 0,
        items: [],
      };

      const feedback = buildRefreshAllFeedback(result, t);

      expect(feedback.type).toBe('info');
      expect(feedback.title).toBe('No RSS Sources');
      expect(feedback.message).toBe('There are no enabled RSS sources to refresh.');
    });
  });
});
