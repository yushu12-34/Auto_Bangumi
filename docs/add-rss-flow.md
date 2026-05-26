# AutoBangumi: WebUI 添加 RSS → 下载任务主流程

> 面向新贡献者的技术说明文档。覆盖前端 API 调用、后端 RSS 解析、番剧匹配、下载器规则创建与种子添加的完整链路。

---

## 概述

用户在 WebUI 添加一个 RSS 订阅源后，系统根据 `aggregate` 参数的值走两条不同路径：

| `aggregate` | 含义 | 路径 |
|---|---|---|
| `true` | 聚合模式（默认） | 仅将 RSS 存入数据库，后续由定时任务 `refresh_rss` 批量处理 |
| `false` | 手动模式 | 立即解析 RSS → 生成 Bangumi 数据 → 用户确认后调用 `collect`（旧番收集）或 `subscribe`（新番订阅） |

本说明以 **手动模式（`aggregate=false`）的完整流程**为主线，聚合模式仅涉及流程的前半段。

---

## 入口 API

### 前端入口：[`ab-add-rss.vue`](file:///app/Auto_Bangumi/webui/src/components/ab-add-rss.vue)

组件 `ab-add-rss.vue` 是用户添加 RSS 的 UI 入口。核心逻辑在 `addRss()` 方法中（约 L119-L127）：

```ts
function addRss() {
  if (rss.value.url === '') {
    message.error(t('notify.please_enter', [t('notify.rss_link')]));
    return;
  }

  if (rss.value.aggregate) {
    addRssAggregate(rss.value);   // → POST /api/v1/rss/add
  } else {
    analyzeRss(rss.value);        // → POST /api/v1/rss/analysis
  }
}
```

- `addRssAggregate` 绑定 [`apiRSS.add`](file:///app/Auto_Bangumi/webui/src/api/rss.ts#L13-L16)，直接发送 `POST /api/v1/rss/add`。
- `analyzeRss` 绑定 [`apiDownload.analysis`](file:///app/Auto_Bangumi/webui/src/api/download.ts#L13-L25)，发送 `POST /api/v1/rss/analysis`，成功后将返回的 `BangumiRule` 填入 `rule` 变量，UI 切换至确认步骤（`step = 'confirm'`）。

用户在确认步骤可选择"旧番收集"或"新番订阅"：

| 用户操作 | 对应方法 | API |
|---|---|---|
| 旧番收集 | `collect()` | [`apiDownload.collection`](file:///app/Auto_Bangumi/webui/src/api/download.ts#L33-L42) → `POST /api/v1/rss/collect` |
| 新番订阅 | `subscribe()` | [`apiDownload.subscribe`](file:///app/Auto_Bangumi/webui/src/api/download.ts#L49-L60) → `POST /api/v1/rss/subscribe` |

### 前端状态管理：[`store/rss.ts`](file:///app/Auto_Bangumi/webui/src/store/rss.ts)

Pinia store `useRSSStore` 管理 RSS 列表状态。`getAll()` 调用 [`apiRSS.get()`](file:///app/Auto_Bangumi/webui/src/api/rss.ts#L8-L11)（`GET /api/v1/rss`），并将结果按 `enabled` 状态分组排序。不会直接影响添加流程，但在页面刷新/关闭弹窗时触发重新加载。

---

## 核心对象

### 数据模型

| 模型 | 文件 | 关键字段 |
|---|---|---|
| `RSSItem` | [(models/rss.py)](file:///app/Auto_Bangumi/backend/src/module/models/rss.py) | `id`, `name`, `url`, `aggregate`, `parser`, `enabled`, `connection_status`, `last_error` |
| `Bangumi` | [(models/bangumi.py)](file:///app/Auto_Bangumi/backend/src/module/models/bangumi.py) | `id`, `official_title`, `title_raw`, `season`, `season_raw`, `dpi`, `subtitle`, `filter`, `rss_link`, `rule_name`, `save_path`, `added`, `eps_collect` |
| `Torrent` | [(models/torrent.py)](file:///app/Auto_Bangumi/backend/src/module/models/torrent.py) | `id`, `bangumi_id`, `rss_id`, `name`, `url`, `homepage`, `downloaded`, `qb_hash` |
| `ResponseModel` | [(models/response.py)](file:///app/Auto_Bangumi/backend/src/module/models/response.py) | `status`, `status_code`, `msg_en`, `msg_zh` — 统一 API 响应格式 |

### 核心类

| 类 | 文件 | 职责 |
|---|---|---|
| `RSSEngine` | [(rss/engine.py)](file:///app/Auto_Bangumi/backend/src/module/rss/engine.py) | RSS 增删改查、拉取种子、torrent 匹配、刷新调度 |
| `RSSAnalyser` | [(rss/analyser.py)](file:///app/Auto_Bangumi/backend/src/module/rss/analyser.py) | RSS → Bangumi 数据解析（继承 `TitleParser`） |
| `TitleParser` | [(parser/title_parser.py)](file:///app/Auto_Bangumi/backend/src/module/parser/title_parser.py) | 种子标题解析（`raw_parser`/`mikan_parser`/`tmdb_parser`） |
| `DownloadClient` | [(downloader/download_client.py)](file:///app/Auto_Bangumi/backend/src/module/downloader/download_client.py) | 统一下载客户端抽象层 |
| `QbDownloader` | [(downloader/client/qb_downloader.py)](file:///app/Auto_Bangumi/backend/src/module/downloader/client/qb_downloader.py) | qBittorrent WebAPI 封装 |
| `SeasonCollector` | [(manager/collector.py)](file:///app/Auto_Bangumi/backend/src/module/manager/collector.py) | 番剧季集收集（旧番收集/新番订阅） |
| `RequestContent` | [(network/request_contents.py)](file:///app/Auto_Bangumi/backend/src/module/network/request_contents.py) | HTTP 请求 + RSS XML 解析 |
| `Database` | [(database/combine.py)](file:///app/Auto_Bangumi/backend/src/module/database/combine.py) | 数据库 Session 聚合类，包含 `rss`/`torrent`/`bangumi`/`user` 子模块 |

---

## 调用链

### 路径 A：聚合模式 (`aggregate=true`)

```
[ab-add-rss.vue] addRssAggregate()
  → [api/rss.ts] apiRSS.add(rss)
    → POST /api/v1/rss/add
      → [api/rss.py] add_rss(rss: RSSItem)
        → [rss/engine.py] engine.add_rss(url, name, aggregate, parser)
          ├─ RequestContent.get_rss_title(url)  ← 从 RSS XML 获取 title
          ├─ RSSDatabase.add(rss_data)          ← 写入 SQLite
          └─ 返回 ResponseModel
```

### 路径 B：手动模式 (`aggregate=false`) — 完整链路

```
[ab-add-rss.vue] analyzeRss(rss)
  → [api/download.ts] apiDownload.analysis(rss)
    → POST /api/v1/rss/analysis
      → [api/rss.py] analysis(rss: RSSItem)
        → [rss/analyser.py] analyser.link_to_data(rss)
          ├─ get_rss_torrents(url, full_parse=False)
          │   └─ [network/request_contents.py] get_torrents(url, filter="\d+-\d+")
          │       ├─ get_xml(url) → httpx GET → rss_parser(ElementTree)
          │       └─ 返回 list[Torrent]（只取首条解析成功的结果）
          └─ torrent_to_data(torrent, rss)
              ├─ [parser/title_parser.py] raw_parser(torrent.name)
              │   └─ [parser/analyser/raw_parser.py] process()
              │       ├─ get_group() → 提取字幕组
              │       ├─ TITLE_RE.match() → 拆解标题/集数
              │       ├─ season_process() → 提取季数
              │       ├─ name_process() → 提取中/英/日标题
              │       └─ find_tags() → 分辨率/字幕/来源
              │   → 返回 Episode(name_en, name_zh, name_jp, season, ...)
              │   → 构建 Bangumi(official_title, title_raw, season, ...)
              └─ official_title_parser(bangumi, rss, torrent)
                  ├─ parser="mikan" → mikan_parser(homepage) 爬取番组详情页
                  └─ parser="tmdb"  → tmdb_parser(title, season, lang) 查询 TMDB
                  → 设置 bangumi.poster_link, bangumi.official_title
  → 返回 Bangumi（或 ResponseModel 错误）

// ===== 用户确认后 =====

[ab-add-rss.vue] collect()  // 旧番收集
  → [api/download.ts] apiDownload.collection(rule)
    → POST /api/v1/rss/collect
      → [api/rss.py] download_collection(data: Bangumi)
        → [manager/collector.py] SeasonCollector.collect_season(data, data.rss_link)
          ├─ SearchTorrent.get_torrents(link, filter) → 搜索匹配的种子
          └─ DownloadClient.add_torrent(torrents, bangumi)
              ├─ [network] 获取 .torrent 文件或磁力链接
              └─ [client/qb_downloader.py] add_torrents(urls/files, save_path, ...)
                  → POST /api/v2/torrents/add (qBittorrent WebAPI)
          └─ BangumiDatabase.add/update → 标记 eps_collect=True
          └─ TorrentDatabase.add_all(torrents)

[ab-add-rss.vue] subscribe()  // 新番订阅
  → [api/download.ts] apiDownload.subscribe(rule, rss)
    → POST /api/v1/rss/subscribe
      → [api/rss.py] subscribe(data: Bangumi, rss: RSSItem)
        → [manager/collector.py] SeasonCollector.subscribe_season(data, parser)
          ├─ [rss/engine.py] engine.add_rss(rss_link, official_title, aggregate=False)
          │   └─ RSSDatabase.add → 写入数据库
          ├─ [rss/engine.py] engine.download_bangumi(data)
          │   ├─ RequestContent.get_torrents(rss_link, filter)
          │   ├─ DownloadClient.add_torrent(torrents, bangumi) → QbDownloader
          │   └─ TorrentDatabase.add_all(torrents)
          └─ BangumiDatabase.add(data) → 写入数据库

// ===== 定时任务触发（聚合模式 + 订阅模式的后续刷新） =====

[rss/engine.py] refresh_rss(client, rss_id=None)
  ├─ RSSDatabase.search_active() → 获取所有启用的 RSS
  ├─ asyncio.gather → 并发 _pull_rss_with_status(rss_item)
  │   └─ pull_rss(rss_item)
  │       ├─ _get_torrents(rss) → RequestContent.get_torrents(url)
  │       └─ TorrentDatabase.check_new(torrents) → 过滤已存在的种子
  └─ 对每个 new_torrent:
      ├─ match_torrent(torrent)
      │   └─ BangumiDatabase.match_torrent(torrent.name)
      │       → 在已有 Bangumi 中按 title_raw + title_aliases 匹配
      │       → 如匹配到 filter，检查是否需排除
      └─ 如匹配成功:
          └─ DownloadClient.add_torrent(torrent, matched_data) → QbDownloader
          └─ torrent.downloaded = True
      └─ TorrentDatabase.add_all(new_torrents)
```

### 下载器规则设置

当安装有 qBittorrent 且需自动下载规则时，系统调用：

```
[downloader/download_client.py] set_rule(data: Bangumi)
  → _rule_name(data) → 生成规则名
  → _gen_save_path(data) → 生成保存路径
  → [client/qb_downloader.py] rss_set_rule(rule_name, rule_def)
      → POST /api/v2/rss/setRule
      参数: { enable, mustContain: data.title_raw, mustNotContain, useRegex: true, savePath, ... }
```

---

## 错误边界

### 1. RSS 源不可达

**位置：** [`network/request_url.py:91`](file:///app/Auto_Bangumi/backend/src/module/network/request_url.py#L91-L116) `get_url()` 方法

**场景：** 用户添加的 RSS URL 无法连通（DNS 解析失败、超时、返回 4xx/5xx）。

**现有处理：**
- [`RequestURL.get_url()`](file:///app/Auto_Bangumi/backend/src/module/network/request_url.py#L91) 会重试最多 3 次，每次间隔 5 秒。
- 上层 [`RequestContent.get_xml()`](file:///app/Auto_Bangumi/backend/src/module/network/request_contents.py#L36) 返回 `None`。
- [`RequestContent.get_torrents()`](file:///app/Auto_Bangumi/backend/src/module/network/request_contents.py#L23) 收到 `None` 后返回空列表 `[]`。
- [`RSSAnalyser.link_to_data()`](file:///app/Auto_Bangumi/backend/src/module/rss/analyser.py#L86) 返回 `ResponseModel(status=False, ...)`。
- 聚合模式中，[`RSSEngine._pull_rss_with_status()`](file:///app/Auto_Bangumi/backend/src/module/rss/engine.py#L107-L111) 捕获所有异常，记录到 `rss_item.connection_status = "error"` 和 `rss_item.last_error`。

**潜在风险：**
- 当后台定时刷新（`refresh_rss`）并发处理多个 RSS 源时，一个源失败不影响其他源（`asyncio.gather` 会抛出 `Exception` 但被 `_pull_rss_with_status` 内部 try/except 吞掉）。但如果所有源都使用同一个被防火墙封锁的域名（如 `mikanani.me`），会全部静默失败，用户可能在 WebUI 看不到明显提示。

### 2. 解析不到 season/episode

**位置：** [`parser/analyser/raw_parser.py`](file:///app/Auto_Bangumi/backend/src/module/parser/analyser/raw_parser.py) 的 `process()` 和 `raw_parser()` 函数

**场景：** 种子标题不包含可识别的 season 或 episode 信息，例如标题格式特殊、纯中文集数"第〇话"、特殊符号分隔等。

**现有处理：**
- [`TITLE_RE`](file:///app/Auto_Bangumi/backend/src/module/parser/analyser/raw_parser.py#L8-L10) 正则无法匹配时，转而尝试 [`FALLBACK_EP_PATTERNS`](file:///app/Auto_Bangumi/backend/src/module/parser/analyser/raw_parser.py#L14-L17)。
- `season_process()` 找不到 season 时返回 `season=1`（默认值）。
- `EPISODE_RE` 找不到集数时 `episode=0`。
- [`raw_parser()`](file:///app/Auto_Bangumi/backend/src/module/parser/analyser/raw_parser.py#L199-L207) 在 `process()` 返回 `None` 时会记录 `"Detected non-episodic resource"` 日志并返回 `None`。
- [`TitleParser.raw_parser()`](file:///app/Auto_Bangumi/backend/src/module/parser/title_parser.py#L59-L113) 在收到 `None` 后返回 `None`，最终导致 `torrent_to_data()` 返回 `None`。

**潜在风险：**
- `episode=0` 且 `season=1`（默认值）会通过解析，但数据不准确。下游 [`collect_season`](file:///app/Auto_Bangumi/backend/src/module/manager/collector.py#L14) 和 `subscribe_season` 会把所有集数当作第一季处理。
- 如果 `raw_parser` 返回了 `Bangumi` 但 `official_title` 解析为空或乱码（如中日英标题全部无法提取），[`title_parser.py:L84-L90`](file:///app/Auto_Bangumi/backend/src/module/parser/title_parser.py#L84-L90) 虽然会尝试 fallback，但如果 `title_raw` 也为 `None`，代码会在 L89-L91 记录 warning 并返回 `None`。但如果 `title_raw` 非空而 `official_title` 为空字符串，则不会触发 None 保护——后续 `collect_season` 中的 `logger.info(f"Start collecting {bangumi.official_title}...")` 会输出空标题，但仍会继续执行。

### 3. 下载器认证失败

**位置：** [`client/qb_downloader.py:28`](file:///app/Auto_Bangumi/backend/src/module/downloader/client/qb_downloader.py#L28-L70) `auth()` 方法

**场景：** qBittorrent 的用户名/密码配置错误、服务未启动、IP 被 qBittorrent 封锁（HTTP 403）。

**现有处理：**
- [`QbDownloader.auth()`](file:///app/Auto_Bangumi/backend/src/module/downloader/client/qb_downloader.py#L28-L70) 最多重试 3 次，每次间隔 5 秒。
- 返回 403 时（IP 被封），直接 `break` 退出循环返回 `False`。
- 连接失败（`httpx.ConnectError`）时等待 10 秒后重试。
- 上层 [`DownloadClient.__aenter__()`](file:///app/Auto_Bangumi/backend/src/module/downloader/download_client.py#L59-L63) 在 `auth()` 返回 `False` 后抛出 `ConnectionError("Download client authentication failed")`。
- 调用方（如 [`refresh_rss`](file:///app/Auto_Bangumi/backend/src/module/rss/engine.py#L136)）会因未捕获此异常而中断整个刷新流程。

**潜在风险：**
- [`refresh_rss`](file:///app/Auto_Bangumi/backend/src/module/rss/engine.py#L136-L160) 中，`DownloadClient` 在 `async with` 中实例化。如果认证失败抛出 `ConnectionError`，整个 `refresh_rss` 中断，**所有 RSS 源的本次刷新结果都不会写入数据库**（`rss_item.connection_status` 不会被更新）。这意味着即使某个 RSS 源实际可达，用户也看不到最新状态，因为错误发生在数据库写入之前。

### 4. 批量刷新部分失败

**位置：** [`rss/engine.py:107`](file:///app/Auto_Bangumi/backend/src/module/rss/engine.py#L107-L111) `_pull_rss_with_status()` 和 [`rss/engine.py:136`](file:///app/Auto_Bangumi/backend/src/module/rss/engine.py#L136-L160) `refresh_rss()`

**场景：** 刷新所有 RSS 时（`refresh/all`），`asyncio.gather` 并发拉取多个源，部分源成功部分失败。

**现有处理：**
- 每个源的拉取被 `_pull_rss_with_status` 包裹在 try/except 中，单个失败不会影响其他源。
- 但在循环处理结果时，[L149-L157](file:///app/Auto_Bangumi/backend/src/module/rss/engine.py#L149-L157)：`rss_item` 的 `connection_status`、`last_checked_at`、`last_error` 被更新 → 调用 `self.add(rss_item)` 写入数据库。这里的 `self.add()` 实际上是 **`RSSDatabase.add()`**（通过 `Database` 继承链），但它只检查 URL 是否已存在——如果已存在（RSS 是已有的），会返回 `False` 记为重复，**不会更新**已有记录！

**潜在风险：**
- 关键 Bug：`refresh_rss` 中使用 `self.add(rss_item)` 而非 `self.rss.update()` 来更新连接状态会失败。`RSSDatabase.add()` 在 [`RSSDatabase.add()`](file:///app/Auto_Bangumi/backend/src/module/database/rss.py#L13-L23) 中检查 URL 是否已存在，若已存在则返回 `False` 并跳过。结果就是 **`connection_status`、`last_checked_at`、`last_error` 字段永远不会被写入已持久化的 RSS 记录**。这个 bug 等价于连接状态更新无效。
  - 受影响的路径：定时任务刷新、`GET /rss/refresh/all`、`GET /rss/refresh/{rss_id}`。
  - 这也会导致前端始终看不到 RSS 源的 `connection_status` 和 `last_error`。

---

## 测试建议

### 测试 1：RSS 源连接失败后的 UI 反馈

**目标文件：** [`webui/src/components/ab-add-rss.vue`](file:///app/Auto_Bangumi/webui/src/components/ab-add-rss.vue) + [`backend/src/module/rss/analyser.py`](file:///app/Auto_Bangumi/backend/src/module/rss/analyser.py)

**测试场景：** 用户在 `ab-add-rss.vue` 中输入一个不可达的 RSS 链接（如 `http://localhost:99999/nonexistent.xml`），设为 `aggregate=false`，点击确认。

**验证点：**
1. `apiDownload.analysis()` 是否收到非 2xx 响应/超时后，正确触发 `onError` 回调并显示错误提示。
2. `RSSAnalyser.link_to_data()` → `get_rss_torrents()` → `RequestContent.get_xml()` 在重试耗尽后返回 `None`，`get_torrents()` 返回空列表，`link_to_data()` 返回 `ResponseModel(status=False, msg_en="Cannot find any torrent.")`。
3. 前端应向用户展示可读的错误信息（而非静默失败）。

### 测试 2：`refresh_rss` 中连接状态持久化

**目标文件：** [`backend/src/module/rss/engine.py`](file:///app/Auto_Bangumi/backend/src/module/rss/engine.py#L136-L160) + [`backend/src/module/database/rss.py`](file:///app/Auto_Bangumi/backend/src/module/database/rss.py#L13-L23)

**测试场景：**
1. 添加一个正常可用的 RSS（已存入数据库）。
2. 手动修改该 RSS 在数据库中的 `connection_status` 为 `NULL`。
3. 调用 `GET /api/v1/rss/refresh/all` 触发批量刷新。
4. 再次查询该 RSS 的 `connection_status` 字段。

**验证点：**
- 当前代码使用 `self.add(rss_item)` 更新状态，`RSSDatabase.add()` 在 URL 已存在时返回 `False` 且不执行更新。因此 `connection_status` 不会反映真实的刷新结果。
- 修复方向：应考虑改为调用 `self.rss.update(rss_id, rss_update_data)` 或使用 `session.merge()`。
- **这是一个架构级 bug 的回归测试点**，适合新贡献者通过编写单元测试来验证修复。

### 测试 3：种子标题边缘解析

**目标文件：** [`backend/src/module/parser/analyser/raw_parser.py`](file:///app/Auto_Bangumi/backend/src/module/parser/analyser/raw_parser.py) 的 `process()` 函数

**测试场景：** 使用 `raw_parser.py` 底部的 `if __name__ == "__main__"` 测试框架，构造以下边界标题直接调用 `raw_parser()`：

| 测试标题 | 预期问题 |
|---|---|
| `[组名] 番剧名 - 第〇話 [1080p]` | 中文数字"〇"无法被 `EPISODE_RE` 匹配，episode 应为 0 或失败 |
| `[SubGroup] Anime Title [01(57)] [1080p]` | 应匹配 `FALLBACK_EP_PATTERNS` 中的 `[(\d+)\(\d+\)]` |
| `番剧名`（无任何标签和集数） | `TITLE_RE` 可能不匹配，`process()` 返回 `None` |
| `[SubGroup&SubGroup2] Title - S02E01 [1080p][CHS]` | 多字幕组联合、季度、集数、分辨率、字幕组合 |

**验证点：**
- 每个标题的解析结果中 `Episode.season`、`Episode.episode`、`Episode.title_zh`/`title_en`/`title_jp` 是否正确。
- `raw_parser()` 对无法解析的标题是否返回 `None` 而非抛出异常。

---

## 附录：文件索引

| 层 | 文件 | 职责 |
|---|---|---|
| 前端 API | [`webui/src/api/rss.ts`](file:///app/Auto_Bangumi/webui/src/api/rss.ts) | RSS CRUD + 刷新 API 封装 |
| 前端 API | [`webui/src/api/download.ts`](file:///app/Auto_Bangumi/webui/src/api/download.ts) | 解析/收集/订阅 API 封装 |
| 前端状态 | [`webui/src/store/rss.ts`](file:///app/Auto_Bangumi/webui/src/store/rss.ts) | RSS Pinia Store |
| 前端组件 | [`webui/src/components/ab-add-rss.vue`](file:///app/Auto_Bangumi/webui/src/components/ab-add-rss.vue) | 添加 RSS 弹窗 |
| 后端 API | [`backend/src/module/api/rss.py`](file:///app/Auto_Bangumi/backend/src/module/api/rss.py) | RSS 相关 FastAPI 路由 |
| 后端引擎 | [`backend/src/module/rss/engine.py`](file:///app/Auto_Bangumi/backend/src/module/rss/engine.py) | RSS 业务逻辑核心 |
| 后端解析 | [`backend/src/module/rss/analyser.py`](file:///app/Auto_Bangumi/backend/src/module/rss/analyser.py) | RSS → Bangumi 数据转换 |
| 后端解析 | [`backend/src/module/parser/title_parser.py`](file:///app/Auto_Bangumi/backend/src/module/parser/title_parser.py) | 种子标题解析 + TMDB/Mikan 查询 |
| 后端解析 | [`backend/src/module/parser/analyser/raw_parser.py`](file:///app/Auto_Bangumi/backend/src/module/parser/analyser/raw_parser.py) | 正则标题解析核心 |
| 后端收集 | [`backend/src/module/manager/collector.py`](file:///app/Auto_Bangumi/backend/src/module/manager/collector.py) | 季集收集协调 |
| 后端下载器 | [`backend/src/module/downloader/download_client.py`](file:///app/Auto_Bangumi/backend/src/module/downloader/download_client.py) | 下载器抽象层 |
| 后端下载器 | [`backend/src/module/downloader/client/qb_downloader.py`](file:///app/Auto_Bangumi/backend/src/module/downloader/client/qb_downloader.py) | qBittorrent API 客户端 |
| 后端网络 | [`backend/src/module/network/request_url.py`](file:///app/Auto_Bangumi/backend/src/module/network/request_url.py) | HTTP 客户端封装 |
| 后端网络 | [`backend/src/module/network/request_contents.py`](file:///app/Auto_Bangumi/backend/src/module/network/request_contents.py) | RSS XML 解析 + Torrent 提取 |
| 数据库 | [`backend/src/module/database/rss.py`](file:///app/Auto_Bangumi/backend/src/module/database/rss.py) | RSSItem CRUD |
| 数据库 | [`backend/src/module/database/bangumi.py`](file:///app/Auto_Bangumi/backend/src/module/database/bangumi.py) | Bangumi CRUD + 匹配 |
| 数据库 | [`backend/src/module/database/torrent.py`](file:///app/Auto_Bangumi/backend/src/module/database/torrent.py) | Torrent CRUD + 去重 |