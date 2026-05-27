import type { RSS } from '#/rss';

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

  const message = useMessage();
  const { t } = useMyI18n();

  async function refreshAll() {
    try {
      const result = await apiRSS.refreshAll();
      getAll();

      if (result.total === 0) {
        message.info(t('rss.refresh_no_feeds'));
      } else if (result.failed_count === 0) {
        message.success(t('rss.refresh_all_success'));
      } else if (result.success_count === 0) {
        message.error(t('rss.refresh_all_failed'));
      } else {
        message.warning(
          t('rss.refresh_partial', {
            success: result.success_count,
            failed: result.failed_count,
          })
        );
      }
      return result;
    } catch {
      message.error(t('rss.refresh_all_failed'));
    }
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
