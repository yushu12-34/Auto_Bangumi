"""Tests for RSS API endpoints."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

from module.api import v1
from module.models import RSSRefreshItemResult, ResponseModel
from module.rss.engine import RSSEngine
from module.security.api import get_current_user

from test.factories import make_rss_item, make_torrent


@pytest.fixture
def app():
    app = FastAPI()
    app.include_router(v1, prefix="/api")
    return app


@pytest.fixture
def authed_client(app):
    async def mock_user():
        return "testuser"

    app.dependency_overrides[get_current_user] = mock_user
    client = TestClient(app)
    yield client
    app.dependency_overrides.clear()


@pytest.fixture
def unauthed_client(app):
    return TestClient(app)


class TestAuthRequired:
    @patch("module.security.api.DEV_AUTH_BYPASS", False)
    def test_get_rss_unauthorized(self, unauthed_client):
        response = unauthed_client.get("/api/v1/rss")
        assert response.status_code == 401

    @patch("module.security.api.DEV_AUTH_BYPASS", False)
    def test_add_rss_unauthorized(self, unauthed_client):
        response = unauthed_client.post(
            "/api/v1/rss/add", json={"url": "https://test.com"}
        )
        assert response.status_code == 401


class TestGetRss:
    def test_get_all(self, authed_client):
        items = [
            make_rss_item(id=1, name="Feed 1"),
            make_rss_item(id=2, name="Feed 2"),
        ]
        with patch("module.api.rss.RSSEngine") as MockEngine:
            mock_eng = MagicMock()
            mock_eng.rss.search_all.return_value = items
            MockEngine.return_value.__enter__ = MagicMock(return_value=mock_eng)
            MockEngine.return_value.__exit__ = MagicMock(return_value=False)

            response = authed_client.get("/api/v1/rss")

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2


class TestAddRss:
    def test_add_success(self, authed_client):
        resp_model = ResponseModel(
            status=True, status_code=200, msg_en="Added.", msg_zh="添加成功。"
        )
        with patch("module.api.rss.RSSEngine") as MockEngine:
            mock_eng = MagicMock()
            mock_eng.add_rss = AsyncMock(return_value=resp_model)
            MockEngine.return_value.__enter__ = MagicMock(return_value=mock_eng)
            MockEngine.return_value.__exit__ = MagicMock(return_value=False)

            response = authed_client.post(
                "/api/v1/rss/add",
                json={
                    "url": "https://mikanani.me/RSS/test",
                    "name": "Test Feed",
                    "aggregate": True,
                    "parser": "mikan",
                },
            )

        assert response.status_code == 200


class TestDeleteRss:
    def test_delete_success(self, authed_client):
        with patch("module.api.rss.RSSEngine") as MockEngine:
            mock_eng = MagicMock()
            mock_eng.rss.delete.return_value = True
            MockEngine.return_value.__enter__ = MagicMock(return_value=mock_eng)
            MockEngine.return_value.__exit__ = MagicMock(return_value=False)

            response = authed_client.delete("/api/v1/rss/delete/1")

        assert response.status_code == 200

    def test_delete_failure(self, authed_client):
        with patch("module.api.rss.RSSEngine") as MockEngine:
            mock_eng = MagicMock()
            mock_eng.rss.delete.return_value = False
            MockEngine.return_value.__enter__ = MagicMock(return_value=mock_eng)
            MockEngine.return_value.__exit__ = MagicMock(return_value=False)

            response = authed_client.delete("/api/v1/rss/delete/999")

        assert response.status_code == 406


class TestDisableRss:
    def test_disable_success(self, authed_client):
        with patch("module.api.rss.RSSEngine") as MockEngine:
            mock_eng = MagicMock()
            mock_eng.rss.disable.return_value = True
            MockEngine.return_value.__enter__ = MagicMock(return_value=mock_eng)
            MockEngine.return_value.__exit__ = MagicMock(return_value=False)

            response = authed_client.patch("/api/v1/rss/disable/1")

        assert response.status_code == 200

    def test_disable_failure(self, authed_client):
        with patch("module.api.rss.RSSEngine") as MockEngine:
            mock_eng = MagicMock()
            mock_eng.rss.disable.return_value = False
            MockEngine.return_value.__enter__ = MagicMock(return_value=mock_eng)
            MockEngine.return_value.__exit__ = MagicMock(return_value=False)

            response = authed_client.patch("/api/v1/rss/disable/999")

        assert response.status_code == 406


class TestBatchOperations:
    def test_enable_many(self, authed_client):
        resp_model = ResponseModel(
            status=True, status_code=200, msg_en="Enabled.", msg_zh="启用成功。"
        )
        with patch("module.api.rss.RSSEngine") as MockEngine:
            mock_eng = MagicMock()
            mock_eng.enable_list.return_value = resp_model
            MockEngine.return_value.__enter__ = MagicMock(return_value=mock_eng)
            MockEngine.return_value.__exit__ = MagicMock(return_value=False)

            response = authed_client.post("/api/v1/rss/enable/many", json=[1, 2, 3])

        assert response.status_code == 200

    def test_disable_many(self, authed_client):
        resp_model = ResponseModel(
            status=True, status_code=200, msg_en="Disabled.", msg_zh="禁用成功。"
        )
        with patch("module.api.rss.RSSEngine") as MockEngine:
            mock_eng = MagicMock()
            mock_eng.disable_list.return_value = resp_model
            MockEngine.return_value.__enter__ = MagicMock(return_value=mock_eng)
            MockEngine.return_value.__exit__ = MagicMock(return_value=False)

            response = authed_client.post("/api/v1/rss/disable/many", json=[1, 2])

        assert response.status_code == 200

    def test_delete_many(self, authed_client):
        resp_model = ResponseModel(
            status=True, status_code=200, msg_en="Deleted.", msg_zh="删除成功。"
        )
        with patch("module.api.rss.RSSEngine") as MockEngine:
            mock_eng = MagicMock()
            mock_eng.delete_list.return_value = resp_model
            MockEngine.return_value.__enter__ = MagicMock(return_value=mock_eng)
            MockEngine.return_value.__exit__ = MagicMock(return_value=False)

            response = authed_client.post("/api/v1/rss/delete/many", json=[1, 2])

        assert response.status_code == 200


class TestUpdateRss:
    def test_update_success(self, authed_client):
        with patch("module.api.rss.RSSEngine") as MockEngine:
            mock_eng = MagicMock()
            mock_eng.rss.update.return_value = True
            MockEngine.return_value.__enter__ = MagicMock(return_value=mock_eng)
            MockEngine.return_value.__exit__ = MagicMock(return_value=False)

            response = authed_client.patch(
                "/api/v1/rss/update/1",
                json={"name": "Updated Name", "aggregate": False},
            )

        assert response.status_code == 200


class TestRefreshRss:
    def test_refresh_all_all_success(self, authed_client):
        refresh_items = [
            RSSRefreshItemResult(
                rss_id=1,
                rss_name="Feed 1",
                success=True,
                message="Refresh succeeded.",
            ),
            RSSRefreshItemResult(
                rss_id=2,
                rss_name="Feed 2",
                success=True,
                message="Refresh succeeded.",
            ),
        ]
        with patch("module.api.rss.DownloadClient") as MockClient:
            mock_client = AsyncMock()
            MockClient.return_value.__aenter__ = AsyncMock(return_value=mock_client)
            MockClient.return_value.__aexit__ = AsyncMock(return_value=False)
            with patch("module.api.rss.RSSEngine") as MockEngine:
                mock_eng = MagicMock()
                mock_eng.refresh_rss = AsyncMock(return_value=refresh_items)
                MockEngine.return_value.__enter__ = MagicMock(return_value=mock_eng)
                MockEngine.return_value.__exit__ = MagicMock(return_value=False)

                response = authed_client.get("/api/v1/rss/refresh/all")

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 2
        assert data["success_count"] == 2
        assert data["failed_count"] == 0
        assert data["items"][0]["rss_name"] == "Feed 1"

    def test_refresh_all_partial_failures(self, authed_client):
        refresh_items = [
            RSSRefreshItemResult(
                rss_id=1,
                rss_name="Feed 1",
                success=False,
                message="Connect timeout",
            ),
            RSSRefreshItemResult(
                rss_id=2,
                rss_name="Feed 2",
                success=True,
                message="Refresh succeeded.",
            ),
        ]
        with patch("module.api.rss.DownloadClient") as MockClient:
            mock_client = AsyncMock()
            MockClient.return_value.__aenter__ = AsyncMock(return_value=mock_client)
            MockClient.return_value.__aexit__ = AsyncMock(return_value=False)
            with patch("module.api.rss.RSSEngine") as MockEngine:
                mock_eng = MagicMock()
                mock_eng.refresh_rss = AsyncMock(return_value=refresh_items)
                MockEngine.return_value.__enter__ = MagicMock(return_value=mock_eng)
                MockEngine.return_value.__exit__ = MagicMock(return_value=False)

                response = authed_client.get("/api/v1/rss/refresh/all")

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 2
        assert data["success_count"] == 1
        assert data["failed_count"] == 1
        assert data["items"][0]["message"] == "Connect timeout"

    def test_refresh_all_all_failed(self, authed_client):
        refresh_items = [
            RSSRefreshItemResult(
                rss_id=1,
                rss_name="Feed 1",
                success=False,
                message="403 Forbidden",
            ),
            RSSRefreshItemResult(
                rss_id=2,
                rss_name="Feed 2",
                success=False,
                message="Downloader rejected the torrent",
            ),
        ]
        with patch("module.api.rss.DownloadClient") as MockClient:
            mock_client = AsyncMock()
            MockClient.return_value.__aenter__ = AsyncMock(return_value=mock_client)
            MockClient.return_value.__aexit__ = AsyncMock(return_value=False)
            with patch("module.api.rss.RSSEngine") as MockEngine:
                mock_eng = MagicMock()
                mock_eng.refresh_rss = AsyncMock(return_value=refresh_items)
                MockEngine.return_value.__enter__ = MagicMock(return_value=mock_eng)
                MockEngine.return_value.__exit__ = MagicMock(return_value=False)

                response = authed_client.get("/api/v1/rss/refresh/all")

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 2
        assert data["success_count"] == 0
        assert data["failed_count"] == 2

    def test_refresh_all_empty(self, authed_client):
        with patch("module.api.rss.DownloadClient") as MockClient:
            mock_client = AsyncMock()
            MockClient.return_value.__aenter__ = AsyncMock(return_value=mock_client)
            MockClient.return_value.__aexit__ = AsyncMock(return_value=False)
            with patch("module.api.rss.RSSEngine") as MockEngine:
                mock_eng = MagicMock()
                mock_eng.refresh_rss = AsyncMock(return_value=[])
                MockEngine.return_value.__enter__ = MagicMock(return_value=mock_eng)
                MockEngine.return_value.__exit__ = MagicMock(return_value=False)

                response = authed_client.get("/api/v1/rss/refresh/all")

        assert response.status_code == 200
        assert response.json() == {
            "total": 0,
            "success_count": 0,
            "failed_count": 0,
            "items": [],
        }

    def test_refresh_single(self, authed_client):
        with patch("module.api.rss.DownloadClient") as MockClient:
            mock_client = AsyncMock()
            MockClient.return_value.__aenter__ = AsyncMock(return_value=mock_client)
            MockClient.return_value.__aexit__ = AsyncMock(return_value=False)
            with patch("module.api.rss.RSSEngine") as MockEngine:
                mock_eng = MagicMock()
                mock_eng.refresh_rss = AsyncMock(return_value=[])
                MockEngine.return_value.__enter__ = MagicMock(return_value=mock_eng)
                MockEngine.return_value.__exit__ = MagicMock(return_value=False)

                response = authed_client.get("/api/v1/rss/refresh/1")

        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_refresh_failure_does_not_block_following_rss(self, db_engine):
        rss1 = make_rss_item(id=1, name="Feed 1", url="https://feed1.example/rss")
        rss2 = make_rss_item(id=2, name="Feed 2", url="https://feed2.example/rss")
        torrent = make_torrent(rss_id=2, name="[Group] Feed 2 - 01 [1080p].mkv")

        with RSSEngine(_engine=db_engine) as engine:
            engine.rss.add(rss1)
            engine.rss.add(rss2)
            client = AsyncMock()

            with patch.object(
                RSSEngine,
                "_pull_rss_with_status",
                new=AsyncMock(side_effect=[([], "Feed 1 timeout"), ([torrent], None)]),
            ):
                results = await engine.refresh_rss(client)

            refreshed_rss1 = engine.rss.search_id(1)
            refreshed_rss2 = engine.rss.search_id(2)
            stored_torrents = engine.torrent.search_all()

        assert [item.rss_name for item in results] == ["Feed 1", "Feed 2"]
        assert results[0].success is False
        assert results[1].success is True
        assert refreshed_rss1.connection_status == "error"
        assert refreshed_rss1.last_error == "Feed 1 timeout"
        assert refreshed_rss2.connection_status == "healthy"
        assert refreshed_rss2.last_checked_at is not None
        assert len(stored_torrents) == 1

    @pytest.mark.asyncio
    async def test_refresh_failure_message_masks_sensitive_data(self, db_engine):
        rss1 = make_rss_item(id=1, name="Feed 1", url="https://feed1.example/rss")

        with RSSEngine(_engine=db_engine) as engine:
            engine.rss.add(rss1)
            client = AsyncMock()

            with patch.object(
                RSSEngine,
                "_pull_rss_with_status",
                new=AsyncMock(
                    return_value=(
                        [],
                        "token=abc123 password=secret cookie=sessionid=xyz bearer real-token",
                    )
                ),
            ):
                results = await engine.refresh_rss(client)

        assert results[0].success is False
        assert "abc123" not in results[0].message
        assert "secret" not in results[0].message
        assert "xyz" not in results[0].message
        assert "real-token" not in results[0].message
        assert "********" in results[0].message


class TestGetRssTorrents:
    def test_get_torrents(self, authed_client):
        torrents = [make_torrent(id=1, rss_id=1), make_torrent(id=2, rss_id=1)]
        with patch("module.api.rss.RSSEngine") as MockEngine:
            mock_eng = MagicMock()
            mock_eng.get_rss_torrents.return_value = torrents
            MockEngine.return_value.__enter__ = MagicMock(return_value=mock_eng)
            MockEngine.return_value.__exit__ = MagicMock(return_value=False)

            response = authed_client.get("/api/v1/rss/torrent/1")

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
