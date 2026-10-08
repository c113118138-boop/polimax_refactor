# Location read benchmark

> 專案名稱與路徑更新：2026-10-07。專案名稱為 `polimax_refactor`，本機目錄為 `/home/c113118138/polimax_refactor`。

> 更新：2026-10-05。現行正式架構為 PostgreSQL／PostGIS + FastAPI + React + 公司 SSO。文件更新依程式與部署紀錄核對，未重新執行正式環境驗收。

Run from `polimax_refactor`:

```sh
.venv/bin/python scripts/benchmark_location.py --client-id PLM5 --days 30 --repeats 50 --output /tmp/location-benchmark.json
```

Optional `--start` and `--end` accept ISO datetimes. Use Taiwan local time without
an offset, matching the existing timestamp columns. `--limit` defaults to 1000.
Configuration comes from the project's existing database settings; credentials
are never printed. PostgreSQL is required. This script does not change the API,
schema, indexes or data. It uses a read-only, repeatable-read transaction and a
15-second timeout per statement.

The real spatial column is `gps_readings.location`, geography(Point,4326).
`latitude` and `longitude` are numeric columns. Four variants use the same
client, sorting, trajectory filters and existing window-based sampling:

- `current_all_columns`: pre-optimization whole-row SELECT of the entire row, including SQLAlchemy's spatial column conversion.
- `numeric_columns`: only the needed ID, timestamps and numeric coordinates.
- `location_xy`: ID and timestamps plus ST_Y(location::geometry) as latitude and ST_X(location::geometry) as longitude.
- `location_wkb`: ID and timestamps plus ST_AsBinary(location), decoded in Python using Shapely.

The script warms up all variants, checks matching row IDs, timestamps and
coordinates (absolute tolerance 1e-9 degrees), then shuffles execution order for
each repetition. It aborts on empty samples or differing coordinates. Durations
include execution, fetching, coordinate conversion and JSON serialization. They
exclude connection setup, reflection, authentication, HTTP and browser rendering.
Results describe warm-cache reads on this deployment, not cold-cache performance
or full endpoint latency. Trajectory validity filtering deliberately continues
to use numeric coordinates to isolate the effect of the returned fields.

## Results on 2026-09-30

50 repetitions per variant; 30-day trajectory; median milliseconds:

| Client / query | Baseline whole row | Numeric only | Location SQL X/Y | Location Python WKB |
| --- | ---: | ---: | ---: | ---: |
| PLM5 latest | 0.658 | 0.578 | 0.599 | 0.639 |
| PLM5 trajectory (230 rows) | 9.110 | 6.971 | 6.423 | 15.189 |
| PLM7 latest | 0.727 | 0.520 | 0.543 | 0.689 |
| PLM7 trajectory (92 rows) | 4.244 | 3.511 | 3.287 | 7.137 |

Both samples matched coordinates and row order. Location SQL X/Y was about
6–8% faster than the minimal numeric query for these trajectories, while the
numeric query was slightly faster for latest positions. Whole-row reads have
additional overhead; much of the apparent improvement against the original
query comes from selecting fewer fields. WKB decoding in Python was slower for
trajectories. These small samples do not establish a universal advantage for
location. Full distributions (median, p95, minimum) and ranges are saved in
`location_benchmark_PLM5.json` and `location_benchmark_PLM7.json`.

## Current implementation

Production is PostgreSQL/PostGIS. `gps_history.position_columns()` selects only the necessary identifiers, timestamps and numeric latitude/longitude; positions, trajectories and Beacon reads use these numeric columns. The benchmark whole-row, SQL X/Y and WKB variants are alternatives for measurement, not runtime coordinate source options. UI has no source selector or duration label.

The result table above is the dated 2026-09-30 measurement, not a benchmark rerun on 2026-10-05. JSON artifacts: [PLM5](location_benchmark_PLM5.json), [PLM7](location_benchmark_PLM7.json). Read architecture and validation limits in [PostGIS](../deploy/POSTGIS.md) and [project specification](../PROJECT_SPEC.md).
