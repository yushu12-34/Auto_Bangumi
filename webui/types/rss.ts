export interface RSS {
  id: number;
  name: string;
  url: string;
  aggregate: boolean;
  parser: string;
  enabled: boolean;
  connection_status: string | null;
  last_checked_at: string | null;
  last_error: string | null;
}

export const rssTemplate: RSS = {
  id: 0,
  name: '',
  url: '',
  aggregate: false,
  parser: 'tmdb',
  enabled: false,
  connection_status: null,
  last_checked_at: null,
  last_error: null,
};

export interface RSSRefreshItem {
  rss_id: number;
  rss_name: string;
  success: boolean;
  message: string | null;
}

export interface RSSRefreshResult {
  total: number;
  success_count: number;
  failed_count: number;
  items: RSSRefreshItem[];
}
