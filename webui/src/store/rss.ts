import type { RSSRefreshAllResult, RSSRefreshItemResult } from '#/api';
import type { RSS } from '#/rss';

export interface RSSRefreshFeedback {
  type: 'success' | 'warning' | 'error' | 'info';
  title: string;
  message: string;
  failedItems: RSSRefreshItemResult[];
}

export function sortRSSList(list: RSS[]) {
  const sortByIdDesc = (items: RSS[]) => items.sort((a, b) => b.id - a.id);
  const enabled = sortByIdDesc(list.filter((item) => item.enabled));
  const disabled = sortByIdDesc(list.filter((item) => !item.enabled));
  return [...enabled, ...disabled];
}

export function buildRefreshAllFeedback(
  result: RSSRefreshAllResult,
  t: (key: string, params?: Record<string, number | string>) => string
): RSSRefreshFeedback {
  const failedItems = result.items.filter((item) => !item.success);

  if (result.total === 0) {
    return {
      type: 'info',
      title: t('rss.refresh_summary_empty_title'),
      message: t('rss.refresh_summary_empty_message'),
      failedItems,
    };
  }

  if (result.failed_count === 0) {
    return {
      type: 'success',
      title: t('rss.refresh_summary_success_title'),
      message: t('rss.refresh_summary_success_message', { count: result.success_count }),
      failedItems,
    };
  }

  if (result.success_count === 0) {
    return {
      type: 'error',
      title: t('rss.refresh_summary_failure_title'),
      message: t('rss.refresh_summary_failure_message', { total: result.total }),
      failedItems,
    };
  }

  return {
    type: 'warning',
    title: t('rss.refresh_summary_partial_title'),
    message: t('rss.refresh_summary_partial_message', {
      success: result.success_count,
      total: result.total,
      failed: result.failed_count,
    }),
    failedItems,
  };
}

export const useRSSStore = defineStore('rss', () => {
  const rss = ref<RSS[]>([]);
  const selectedRSS = ref<number[]>([]);

  async function getAll() {
    const res = await apiRSS.get();
    rss.value = sortRSSList(res);
  }

  async function refreshAll() {
    const result = await apiRSS.refreshAll();
    await getAll();
    return result;
  }

  const opts = {
    showMessage: true,
    onSuccess() {
      getAll();
      selectedRSS.value = [];
    },
  };

  const { execute: updateRSS } = useApi(apiRSS.update, opts);
  const { execute: disableRSS } = useApi(apiRSS.disableMany, opts);
  const { execute: deleteRSS } = useApi(apiRSS.deleteMany, opts);
  const { execute: enableRSS } = useApi(apiRSS.enableMany, opts);

  const disableSelected = () => disableRSS(selectedRSS.value);
  const deleteSelected = () => deleteRSS(selectedRSS.value);
  const enableSelected = () => enableRSS(selectedRSS.value);

  return {
    rss,
    selectedRSS,

    getAll,
    refreshAll,
    updateRSS,
    disableRSS,
    deleteRSS,
    enableRSS,
    disableSelected,
    deleteSelected,
    enableSelected,
  };
});
