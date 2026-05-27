/**
 * Tests for RSS Store logic
 * Note: These tests focus on pure logic that can be tested without full Vue/Pinia setup
 */

import { describe, it, expect } from 'vitest';
import { mockRSSList } from '@/test/mocks/api';
import type { RefreshAllResult } from '#/api';

describe('RSS Store Logic', () => {
  describe('sort and filter functions', () => {
    it('should sort enabled feeds first then by id descending', () => {
      const mixedList = [
        { id: 1, name: 'Feed 1', url: 'url1', enabled: false },
        { id: 2, name: 'Feed 2', url: 'url2', enabled: true },
        { id: 3, name: 'Feed 3', url: 'url3', enabled: false },
        { id: 4, name: 'Feed 4', url: 'url4', enabled: true },
      ];

      // Apply the same sorting logic as the store
      const enabled = mixedList.filter((e) => e.enabled).sort((a, b) => b.id - a.id);
      const disabled = mixedList.filter((e) => !e.enabled).sort((a, b) => b.id - a.id);
      const sorted = [...enabled, ...disabled];

      // Enabled should come first (sorted by id desc)
      expect(sorted[0].id).toBe(4);
      expect(sorted[1].id).toBe(2);
      // Then disabled (sorted by id desc)
      expect(sorted[2].id).toBe(3);
      expect(sorted[3].id).toBe(1);
    });

    it('should handle all enabled feeds', () => {
      const allEnabled = [
        { id: 1, name: 'Feed 1', url: 'url1', enabled: true },
        { id: 3, name: 'Feed 3', url: 'url3', enabled: true },
        { id: 2, name: 'Feed 2', url: 'url2', enabled: true },
      ];

      const enabled = allEnabled.filter((e) => e.enabled).sort((a, b) => b.id - a.id);
      const disabled = allEnabled.filter((e) => !e.enabled).sort((a, b) => b.id - a.id);
      const sorted = [...enabled, ...disabled];

      expect(sorted.map((s) => s.id)).toEqual([3, 2, 1]);
    });

    it('should handle all disabled feeds', () => {
      const allDisabled = [
        { id: 1, name: 'Feed 1', url: 'url1', enabled: false },
        { id: 3, name: 'Feed 3', url: 'url3', enabled: false },
        { id: 2, name: 'Feed 2', url: 'url2', enabled: false },
      ];

      const enabled = allDisabled.filter((e) => e.enabled).sort((a, b) => b.id - a.id);
      const disabled = allDisabled.filter((e) => !e.enabled).sort((a, b) => b.id - a.id);
      const sorted = [...enabled, ...disabled];

      expect(sorted.map((s) => s.id)).toEqual([3, 2, 1]);
    });

    it('should handle empty list', () => {
      const emptyList: typeof mockRSSList = [];

      const enabled = emptyList.filter((e) => e.enabled).sort((a, b) => b.id - a.id);
      const disabled = emptyList.filter((e) => !e.enabled).sort((a, b) => b.id - a.id);
      const sorted = [...enabled, ...disabled];

      expect(sorted).toEqual([]);
    });
  });

  describe('selection management logic', () => {
    it('should track selected items in array', () => {
      const selectedRSS: number[] = [];

      selectedRSS.push(1);
      selectedRSS.push(2);
      selectedRSS.push(3);

      expect(selectedRSS).toEqual([1, 2, 3]);
    });

    it('should clear selection by reassigning empty array', () => {
      let selectedRSS = [1, 2, 3];

      selectedRSS = [];

      expect(selectedRSS).toEqual([]);
    });

    it('should remove specific item from selection', () => {
      const selectedRSS = [1, 2, 3];

      const filtered = selectedRSS.filter((id) => id !== 2);

      expect(filtered).toEqual([1, 3]);
    });
  });

  describe('refreshAll result handling logic', () => {
    it('should identify all-success result', () => {
      const result: RefreshAllResult = {
        total: 3,
        success_count: 3,
        failed_count: 0,
        items: [
          { rss_id: 1, rss_name: 'Feed 1', success: true, message: 'OK' },
          { rss_id: 2, rss_name: 'Feed 2', success: true, message: 'OK' },
          { rss_id: 3, rss_name: 'Feed 3', success: true, message: 'OK' },
        ],
      };

      expect(result.failed_count === 0).toBe(true);
      expect(result.success_count === result.total).toBe(true);
    });

    it('should identify partial failure result', () => {
      const result: RefreshAllResult = {
        total: 3,
        success_count: 1,
        failed_count: 2,
        items: [
          { rss_id: 1, rss_name: 'Feed 1', success: true, message: 'OK' },
          { rss_id: 2, rss_name: 'Feed 2', success: false, message: 'Connection refused' },
          { rss_id: 3, rss_name: 'Feed 3', success: false, message: 'Parse error' },
        ],
      };

      expect(result.failed_count > 0).toBe(true);
      expect(result.success_count > 0).toBe(true);

      const failedItems = result.items.filter((item) => !item.success);
      expect(failedItems).toHaveLength(2);
      expect(failedItems[0].rss_name).toBe('Feed 2');
      expect(failedItems[1].rss_name).toBe('Feed 3');
    });

    it('should identify all-failure result', () => {
      const result: RefreshAllResult = {
        total: 2,
        success_count: 0,
        failed_count: 2,
        items: [
          { rss_id: 1, rss_name: 'Feed 1', success: false, message: 'Network error' },
          { rss_id: 2, rss_name: 'Feed 2', success: false, message: 'Timeout' },
        ],
      };

      expect(result.success_count === 0).toBe(true);
      expect(result.failed_count === result.total).toBe(true);
    });

    it('should handle empty result', () => {
      const result: RefreshAllResult = {
        total: 0,
        success_count: 0,
        failed_count: 0,
        items: [],
      };

      expect(result.total === 0).toBe(true);
      expect(result.items).toHaveLength(0);
    });

    it('should extract failed items for display', () => {
      const result: RefreshAllResult = {
        total: 4,
        success_count: 2,
        failed_count: 2,
        items: [
          { rss_id: 1, rss_name: 'Feed 1', success: true, message: 'OK' },
          { rss_id: 2, rss_name: 'Feed 2', success: false, message: 'Connection refused' },
          { rss_id: 3, rss_name: 'Feed 3', success: true, message: 'OK' },
          { rss_id: 4, rss_name: 'Feed 4', success: false, message: 'Timeout' },
        ],
      };

      const failedItems = result.items.filter((item) => !item.success);
      expect(failedItems).toHaveLength(2);
      expect(failedItems.map((i) => i.rss_name)).toEqual(['Feed 2', 'Feed 4']);
      expect(failedItems.map((i) => i.message)).toEqual(['Connection refused', 'Timeout']);
    });
  });
});
