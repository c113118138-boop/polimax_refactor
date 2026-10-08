# PostGIS location support

> 專案名稱與路徑更新：2026-10-07。專案名稱為 `polimax_refactor`，本機目錄為 `/home/c113118138/polimax_refactor`。

> 更新：2026-10-05。現行正式架構為 PostgreSQL／PostGIS + FastAPI + React + 公司 SSO。文件更新依程式與部署紀錄核對，未重新執行正式環境驗收。

The live and archive databases both require PostGIS. Install the pinned backend
requirements (including GeoAlchemy2 and Shapely) before starting application or
maintenance processes. GeoAlchemy2 registers SQLAlchemy geography reflection;
Shapely supports binding the returned geography WKB values during archival.
The database, legacy repository and retention entry points import GeoAlchemy2.

`scripts/add_location.sql` is a one-time migration for gps_readings, new_reports
and FindMy. It has already been applied to this deployment; do not rerun it.
For a new deployment, back up both databases, enable PostGIS in both, suspend
archive jobs during migration, apply to the archive then live database and
resume only after both schemas match. Existing archive tables must exist first.
The SQL runs in a transaction and fails if the function/columns already exist.

Each table keeps latitude/longitude as its source of truth. A BEFORE INSERT OR
UPDATE trigger populates location as geography(Point,4326), longitude first.
Null or out-of-range coordinates produce NULL; device sentinel values inside
valid ranges remain subject to the existing application filters. A GiST index
supports spatial searches. These changes assume input coordinates are WGS84.

API positions and trajectories continue to expose numeric lat/lng. Archive
manifests serialize WKB using the existing canonical string serializer, and
round-trip verification still precedes source deletion.

The latest-position, trajectory and Beacon APIs read latitude/longitude columns
only. Their pages have no coordinate source selector or request duration display.
Existing PostGIS columns remain available to migration and archival processes.

Validation (creates a disposable PostgreSQL cluster; no production credentials):

```sh
.venv/bin/python -m unittest discover -s tests -p test_retention.py
```

Requires PostgreSQL 16 binaries and its PostGIS extension files. The spatial test
checks the migration, reflection, coordinate updates, invalid coordinates,
meter-based distance, positions/trajectory API responses, archive round-trip,
verification, source deletion guards and repeated-run behavior.

UI verification uses an isolated demo database and mocked coordinate responses:

```sh
node tests/browser_location.mjs
```

Requires the installed Playwright Chromium and browser system libraries. On
this host, use `LD_LIBRARY_PATH=$HOME/.cache/polimax-browser-deps/usr/lib/x86_64-linux-gnu`
before the command. This checks numeric queries, refreshing, removal of the
source selector and timing labels, NULL trajectory handling and Beacon empty
state. It mocks demo auth/config because the existing demo middleware protects
that route. Numeric reads with divergent or NULL spatial data are covered by the
disposable PostgreSQL tests above.

## Current deployment boundary

Production uses PostgreSQL exclusively; MySQL compatibility code is not a deployment requirement. Both databases and persistent files must be restored together; see [deployment](README.md) and [archive retention](ARCHIVE_RETENTION.md).

The numeric coordinate query is the current API implementation. SQL X/Y and Python WKB in the [benchmark](../scripts/LOCATION_BENCHMARK.md) are comparison variants, not selectable production API sources. Latest positions do not apply the same validity filter as trajectories. This documentation update did not rerun migration, benchmarks or tests.
