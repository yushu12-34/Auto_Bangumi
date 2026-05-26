<script lang="tsx" setup>
import { NAlert, type DataTableColumns, NDataTable, NTooltip } from 'naive-ui';
import type { RSSRefreshAllResult } from '#/api';
import type { RSS } from '#/rss';
import { buildRefreshAllFeedback } from '@/store/rss';

definePage({
  name: 'RSS',
});

const message = useMessage();
const { t } = useMyI18n();
const { isMobile } = useBreakpointQuery();
const { rss, selectedRSS } = storeToRefs(useRSSStore());
const { getAll, refreshAll, deleteSelected, disableSelected, enableSelected } =
  useRSSStore();

const isRefreshingAll = ref(false);
const refreshSummary = ref<RSSRefreshAllResult | null>(null);

onActivated(() => {
  getAll();
});

const refreshFeedback = computed(() => {
  if (!refreshSummary.value) return null;
  return buildRefreshAllFeedback(refreshSummary.value, t);
});

const failedRefreshItems = computed(
  () => refreshFeedback.value?.failedItems ?? []
);

function handleMobileSelect(keys: number[]) {
  selectedRSS.value = keys;
}

function handleCheckedRowKeys(keys: number[]) {
  selectedRSS.value = keys;
}

async function handleRefreshAll() {
  isRefreshingAll.value = true;
  try {
    const result = await refreshAll();
    refreshSummary.value = result;
    const feedback = buildRefreshAllFeedback(result, t);
    const content = `${feedback.title} ${feedback.message}`;

    if (feedback.type === 'success') {
      message.success(content);
    } else if (feedback.type === 'warning') {
      message.warning(content);
    } else if (feedback.type === 'error') {
      message.error(content);
    } else {
      message.info(content);
    }
  } finally {
    isRefreshingAll.value = false;
  }
}

const rssColumns = computed<DataTableColumns<RSS>>(() => [
  {
    type: 'selection',
  },
  {
    title: t('rss.name'),
    key: 'name',
    className: 'text-h3',
    ellipsis: {
      tooltip: true,
    },
  },
  {
    title: t('rss.url'),
    key: 'url',
    className: 'text-h3',
    minWidth: 400,
    align: 'center',
    ellipsis: {
      tooltip: true,
    },
  },
  {
    title: t('rss.status'),
    key: 'status',
    className: 'text-h3',
    align: 'right',
    minWidth: 200,
    render(rss: RSS) {
      return (
        <div flex="~ justify-end gap-x-8">
          {rss.parser && <ab-tag type="primary" title={rss.parser} />}
          {rss.aggregate && <ab-tag type="primary" title="aggregate" />}
          {rss.connection_status === 'healthy' && (
            <ab-tag type="active" title={t('rss.connected')} />
          )}
          {rss.connection_status === 'error' && (
            <NTooltip>
              {{
                trigger: () => <ab-tag type="warn" title={t('rss.error')} />,
                default: () => rss.last_error || t('rss.refresh_unknown_error'),
              }}
            </NTooltip>
          )}
          {rss.enabled ? (
            <ab-tag type="active" title="active" />
          ) : (
            <ab-tag type="inactive" title="inactive" />
          )}
        </div>
      );
    },
  },
]);

const rssRowKey = (row: RSS) => row.id;
</script>

<template>
  <div class="page-rss">
    <ab-container :title="$t('rss.title')">
      <template #title-right>
        <ab-button size="small" :loading="isRefreshingAll" @click="handleRefreshAll">
          {{ $t('rss.refresh_all') }}
        </ab-button>
      </template>

      <NAlert
        v-if="refreshFeedback"
        :type="refreshFeedback.type"
        :title="refreshFeedback.title"
        class="rss-refresh-summary"
      >
        <div>{{ refreshFeedback.message }}</div>
        <div v-if="failedRefreshItems.length > 0" class="rss-refresh-failure-block">
          <div class="rss-refresh-failure-title">
            {{ $t('rss.refresh_failed_items_title') }}
          </div>
          <ul class="rss-refresh-failure-list">
            <li
              v-for="item in failedRefreshItems"
              :key="item.rss_id"
              class="rss-refresh-failure-item"
            >
              <span class="rss-refresh-failure-name">{{ item.rss_name }}</span>
              <span>{{ item.message }}</span>
            </li>
          </ul>
        </div>
      </NAlert>

      <ab-data-list
        v-if="isMobile"
        :items="rss || []"
        :columns="[
          { key: 'name', title: t('rss.name') },
          { key: 'url', title: t('rss.url') },
        ]"
        :selectable="true"
        key-field="id"
        @select="handleMobileSelect"
      >
        <template #item="{ item }">
          <div class="rss-card-content">
            <div class="rss-card-name">{{ item.name }}</div>
            <div class="rss-card-url">{{ item.url }}</div>
            <div class="rss-card-tags">
              <ab-tag v-if="item.parser" type="primary" :title="item.parser" />
              <ab-tag v-if="item.aggregate" type="primary" title="aggregate" />
              <ab-tag
                v-if="item.connection_status === 'healthy'"
                type="active"
                :title="$t('rss.connected')"
              />
              <NTooltip v-if="item.connection_status === 'error'">
                <template #trigger>
                  <ab-tag type="warn" :title="$t('rss.error')" />
                </template>
                {{ item.last_error || $t('rss.refresh_unknown_error') }}
              </NTooltip>
              <ab-tag
                :type="item.enabled ? 'active' : 'inactive'"
                :title="item.enabled ? 'active' : 'inactive'"
              />
            </div>
          </div>
        </template>
      </ab-data-list>

      <NDataTable
        v-else
        :columns="rssColumns"
        :data="rss"
        :row-key="rssRowKey"
        :pagination="false"
        :bordered="false"
        :max-height="500"
        @update:checked-row-keys="handleCheckedRowKeys"
      ></NDataTable>

      <div v-if="selectedRSS.length > 0">
        <div class="divider"></div>
        <div class="rss-actions">
          <ab-button @click="enableSelected">{{ $t('rss.enable') }}</ab-button>
          <ab-button @click="disableSelected">{{
            $t('rss.disable')
          }}</ab-button>
          <ab-button type="warn" @click="deleteSelected">{{
            $t('rss.delete')
          }}</ab-button>
        </div>
      </div>
    </ab-container>
  </div>
</template>

<style lang="scss" scoped>
.page-rss {
  overflow: auto;
  flex-grow: 1;
}

.divider {
  width: 100%;
  height: 1px;
  background: var(--color-border);
  margin: 12px 0;
}

.rss-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;

  @include forTablet {
    gap: 10px;
  }
}

.rss-refresh-summary {
  margin-bottom: 12px;
}

.rss-refresh-failure-block {
  margin-top: 12px;
}

.rss-refresh-failure-title {
  font-weight: 600;
  margin-bottom: 6px;
}

.rss-refresh-failure-list {
  margin: 0;
  padding-left: 18px;
}

.rss-refresh-failure-item {
  margin-bottom: 4px;
}

.rss-refresh-failure-name {
  font-weight: 600;
  margin-right: 6px;
}

.rss-card-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.rss-card-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rss-card-url {
  font-size: 12px;
  color: var(--color-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rss-card-tags {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  margin-top: 4px;
}
</style>
