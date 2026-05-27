import type { RSS, BatchRefreshResult, RSSRefreshResult } from '#/rss';

export const useRSSStore = defineStore('rss', () => {
  const rss = ref<RSS[]>([]);
  const selectedRSS = ref<number[]>([]);

  async function getAll() {
    const res = await apiRSS.get();

    function sort(arr: RSS[]) {
      return arr.sort((a, b) => b.id - a.id);
    }

    const enabled = sort(res.filter((e) => e.enabled));
    const disabled = sort(res.filter((e) => !e.enabled));

    rss.value = [...enabled, ...disabled];
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

  // Refresh all RSS with structured result display
  const message = useMessage();
  const { t } = useMyI18n();

  async function refreshAllRSS(): Promise<BatchRefreshResult> {
    const result = await apiRSS.refreshAll();
    const { total, success_count, failed_count } = result;

    if (total === 0) {
      message.info(t('rss.refresh_empty'));
    } else if (failed_count === 0) {
      message.success(t('rss.refresh_all_success', { count: success_count }));
    } else if (success_count === 0) {
      message.error(t('rss.refresh_all_failed', { count: failed_count }));
    } else {
      // Partial failure: show warning with failed item names
      const failedNames = result.items
        .filter((item: RSSRefreshResult) => !item.success)
        .map((item: RSSRefreshResult) => item.rss_name)
        .join(', ');
      const detail = result.items
        .filter((item: RSSRefreshResult) => !item.success)
        .map((item: RSSRefreshResult) => `${item.rss_name}: ${item.message}`)
        .join('\n');
      message.warning(
        t('rss.refresh_partial', {
          success: success_count,
          failed: failed_count,
          names: failedNames,
        }),
        { duration: 5000 }
      );
      // Log full details to console for debugging
      console.warn('[RSS Refresh] Partial failure details:\n' + detail);
    }

    getAll();
    return result;
  }

  return {
    rss,
    selectedRSS,

    getAll,
    updateRSS,
    disableRSS,
    deleteRSS,
    enableRSS,
    disableSelected,
    deleteSelected,
    enableSelected,
    refreshAllRSS,
  };
});
