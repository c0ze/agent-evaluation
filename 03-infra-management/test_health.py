"""Offline unit checks with dependency doubles, not container/integration tests.

Run: python3 -B -m unittest -v test_health.py
No third-party packages, sockets, or Docker daemon are used.
"""

import importlib.util
import io
import os
from pathlib import Path
import types
import unittest
from unittest.mock import MagicMock, patch
from urllib.error import HTTPError, URLError

import healthcheck


class DatabaseError(Exception):
    pass


class CacheError(Exception):
    pass


class ReadinessTests(unittest.TestCase):
    def setUp(self):
        flask = types.ModuleType("flask")
        flask.Flask = lambda name: types.SimpleNamespace(
            get=lambda route: lambda handler: handler
        )
        flask.jsonify = lambda **payload: payload
        self.pg = types.ModuleType("psycopg2")
        self.pg.Error = DatabaseError
        self.pg.connect = MagicMock()
        self.connection = self.pg.connect.return_value
        self.cursor = self.connection.cursor.return_value.__enter__.return_value
        self.cursor.fetchone.return_value = (1,)
        self.redis = types.ModuleType("redis")
        self.redis.exceptions = types.SimpleNamespace(RedisError=CacheError)
        self.redis.Redis = MagicMock()
        self.cache = self.redis.Redis.return_value.__enter__.return_value
        self.cache.ping.return_value = True
        backoff = types.ModuleType("redis.backoff")
        backoff.NoBackoff = MagicMock()
        retry = types.ModuleType("redis.retry")
        retry.Retry = MagicMock()
        modules = {
            "flask": flask, "psycopg2": self.pg, "redis": self.redis,
            "redis.backoff": backoff, "redis.retry": retry,
        }
        spec = importlib.util.spec_from_file_location(
            "api_under_test", Path(__file__).with_name("app.py")
        )
        self.api = importlib.util.module_from_spec(spec)
        with patch.dict("sys.modules", modules):
            spec.loader.exec_module(self.api)
        environment = {
            "POSTGRES_HOST": "db", "POSTGRES_PORT": "5432",
            "POSTGRES_USER": "app", "POSTGRES_DB": "app",
            "POSTGRES_PASSWORD": "unit-test:@/$ value",
            "REDIS_HOST": "cache", "REDIS_PORT": "6379",
            "REDIS_PASSWORD": "unit-test-redis",
        }
        self.env = patch.dict(os.environ, environment, clear=True)
        self.env.start()
        self.addCleanup(self.env.stop)

    def test_ready_checks_both_dependencies_and_closes_connections(self):
        self.assertEqual(self.api.ready(), {"status": "ready"})
        self.cursor.execute.assert_called_once_with("SELECT 1")
        self.cache.ping.assert_called_once()
        self.connection.close.assert_called_once()
        self.redis.Redis.return_value.__exit__.assert_called_once()
        self.assertEqual(
            self.pg.connect.call_args.kwargs["password"], "unit-test:@/$ value"
        )

    def test_database_connection_failure_is_unavailable_without_details(self):
        self.pg.connect.side_effect = DatabaseError("private credential detail")
        self.assertEqual(self.api.ready(), ({"status": "unavailable"}, 503))
        self.redis.Redis.assert_not_called()

    def test_database_query_failure_closes_connection(self):
        self.cursor.execute.side_effect = DatabaseError("query failed")
        self.assertEqual(self.api.ready(), ({"status": "unavailable"}, 503))
        self.connection.close.assert_called_once()

    def test_unexpected_database_result_is_unavailable(self):
        self.cursor.fetchone.return_value = None
        self.assertEqual(self.api.ready(), ({"status": "unavailable"}, 503))
        self.connection.close.assert_called_once()

    def test_redis_failure_is_unavailable_and_closes_client(self):
        self.cache.ping.side_effect = CacheError("private credential detail")
        self.assertEqual(self.api.ready(), ({"status": "unavailable"}, 503))
        self.redis.Redis.return_value.__exit__.assert_called_once()

    def test_negative_redis_reply_is_unavailable(self):
        self.cache.ping.return_value = False
        self.assertEqual(self.api.ready(), ({"status": "unavailable"}, 503))

    def test_missing_configuration_is_unavailable(self):
        del os.environ["POSTGRES_PASSWORD"]
        self.assertEqual(self.api.ready(), ({"status": "unavailable"}, 503))

    def test_liveness_does_not_require_dependencies(self):
        self.assertEqual(self.api.live(), {"status": "alive"})
        self.pg.connect.assert_not_called()
        self.redis.Redis.assert_not_called()


class ProbeTests(unittest.TestCase):
    def test_http_status_and_payload_must_both_indicate_readiness(self):
        cases = [
            (200, b'{"status":"ready"}', 0),
            (503, b'{"status":"ready"}', 1),
            (200, b'{"status":"unavailable"}', 1),
            (200, b'not json', 1),
            (200, b'null', 1),
        ]
        for status, payload, expected in cases:
            with self.subTest(status=status, payload=payload):
                response = io.BytesIO(payload)
                response.status = status
                with patch.object(healthcheck, "urlopen", return_value=response):
                    self.assertEqual(healthcheck.main(), expected)

    def test_connection_timeout_and_http_errors_fail_the_probe(self):
        errors = [
            URLError("connection refused"), TimeoutError("timeout"),
            HTTPError("http://unused", 503, "unavailable", {}, None),
        ]
        self.addCleanup(errors[-1].close)
        for error in errors:
            with self.subTest(error=type(error).__name__):
                with patch.object(healthcheck, "urlopen", side_effect=error):
                    self.assertEqual(healthcheck.main(), 1)


if __name__ == "__main__":
    unittest.main()
