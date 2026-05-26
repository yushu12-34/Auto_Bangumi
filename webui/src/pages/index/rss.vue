<script lang="tsx" setup>
import { type DataTableColumns, NDataTable, NTooltip } from 'naive-ui';
import type { RSS } from '#/rss';
import type { RSSRefreshAllResult, RSSRefreshResultItem } from '#/api';

definePage({
  name: 'RSS',
});

const { t } = useMyI18n();
const { isMobile } = useBreakpointQuery();
const { rss, selectedRSS } = storeToRefs(useRSSStore());
const { getAll, deleteSelected, disableSelected, enableSelected } =
  useRSSStore();

const message = useMessage();
const isRefreshing = ref(false);
const refreshResult = ref<RSSRefreshAllResult | null>(null);

onActivated(() => {
  getAll();
});

async function handleRefreshAll() {
  if (isRefreshing.value) return;
  isRefreshing.value = true;
  try {
    const result = await apiRSS.refreshAll();
    refreshResult.value = result;
    
    // Refresh the RSS list to show updated status
    await getAll();
    
    // Show result message
    if (result.failed_count === 0) {
      message.success(t('rss.refresh_all_success', { total: result.total }));
    } else if (result.success_count === 0) {
      message.error(t('rss.refresh_all_failed', { total: result.total }));
    } else {
      message.warning(
        t('rss.refresh_partial_failed', {
          success: result.success_count,
          failed: result.failed_count,
        })
      );
    }
  } catch (error) {
    console.error('Refresh all failed:', error);
    message.error(t('rss.refresh_failed'));
  } finally {
    isRefreshing.value = false;
  }
}

function clearRefreshResult() {
  refreshResult.value = null;
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
                default: () => rss.last_error || 'Unknown error',
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
      <!-- Refresh button -->
      <div class="rss-toolbar">
        <ab-button @click="handleRefreshAll" :loading="isRefreshing">
          {{ $t('rss.refresh_all') }}
        </ab-button>
      </div>

      <!-- Refresh result summary -->
      <div v-if="refreshResult" class="refresh-result">
        <div class="refresh-summary">
          <ab-tag type="primary">
            {{ t('rss.refresh_total', { count: refreshResult.total }) }}
          </ab-tag>
          <ab-tag type="success">
            {{ t('rss.refresh_success', { count: refreshResult.success_count }) }}
          </ab-tag>
          <ab-tag v-if="refreshResult.failed_count > 0" type="warn">
            {{ t('rss.refresh_failed', { count: refreshResult.failed_count }) }}
          </ab-tag>
          <ab-button size="small" type="text" @click="clearRefreshResult">
            {{ t('common.close') }}
          </ab-button>
        </div>
        
        <!-- Failed items details -->
        <div v-if="refreshResult.failed_count > 0" class="failed-items">
          <div class="failed-title">{{ t('rss.failed_details') }}</div>
          <div v-for="item in refreshResult.items.filter(i => !i.success)" :key="item.rss_id" class="failed-item">
            <span class="failed-name">{{ item.rss_name }}</span>
            <span class="failed-message">{{ item.message }}</span>
          </div>
        </div>
      </div>

      <!-- Mobile: Card-based list -->
      <ab-data-list
        v-if="isMobile"
        :items="rss || []"
        :columns="[
          { key: 'name', title: t('rss.name') },
          { key: 'url', title: t('rss.url') },
        ]"
        :selectable="true"
        key-field="id"
        @select="(keys) => (selectedRSS = keys as number[])"
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
                {{ item.last_error || 'Unknown error' }}
              </NTooltip>
              <ab-tag
                :type="item.enabled ? 'active' : 'inactive'"
                :title="item.enabled ? 'active' : 'inactive'"
              />
            </div>
          </div>
        </template>
      </ab-data-list>

      <!-- Desktop: Data table -->
      <NDataTable
        v-else
        :columns="rssColumns"
        :data="rss"
        :row-key="rssRowKey"
        :pagination="false"
        :bordered="false"
        :max-height="500"
        @update:checked-row-keys="(e) => (selectedRSS = (e as number[]))"
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

.rss-toolbar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 12px;
}

.refresh-result {
  background: var(--color-bg-secondary);
  border-radius: var(--radius-md);
  padding: 12px;
  margin-bottom: 12px;
  border: 1px solid var(--color-border);
}

.refresh-summary {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: space-between;
}

.failed-items {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--color-border);
}

.failed-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text);
  margin-bottom: 8px;
}

.failed-item {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 8px 12px;
  background: var(--color-danger-light);
  border-radius: var(--radius-sm);
  margin-bottom: 6px;
  gap: 12px;
}

.failed-name {
  font-weight: 500;
  color: var(--color-danger);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex-shrink: 0;
}

.failed-message {
  font-size: 13px;
  color: var(--color-text-muted);
  word-break: break-all;
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

// Mobile RSS card styles
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
