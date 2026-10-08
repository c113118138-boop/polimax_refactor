"""Read-only comparison of numeric coordinates and PostGIS location reads."""
import argparse
from datetime import datetime, timedelta
import json
from pathlib import Path
import random
import statistics
import sys
from time import perf_counter
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'backend'))
from database import configuration
from sqlalchemy import MetaData, Table, cast, create_engine, func, or_, select, text
from geoalchemy2 import Geometry
from shapely import wkb


def query(table, source, client, start, end, limit, latest=False):
    if source == 'current_all_columns':
        columns = list(table.c)
    else:
        columns = [table.c.id, table.c.record_time, table.c.created_at]
        if source == 'numeric_columns':
            columns += [table.c.latitude, table.c.longitude]
        elif source == 'location_xy':
            geometry = cast(table.c.location, Geometry(geometry_type="POINT", srid=4326))
            columns += [func.ST_Y(geometry).label('latitude'),
                        func.ST_X(geometry).label('longitude')]
        else:
            columns += [func.ST_AsBinary(table.c.location).label('location_wkb')]
    if latest:
        return select(*columns).where(table.c.client_id == client).order_by(
            table.c.record_time.desc(), table.c.id.desc()).limit(1)
    valid = (table.c.client_id == client, table.c.created_at >= start,
             table.c.created_at < end, table.c.latitude.between(-90, 90),
             table.c.longitude.between(-180, 180), func.abs(table.c.latitude) > 0.001,
             func.abs(table.c.longitude) > 0.001)
    ranked = select(*columns, func.row_number().over(order_by=(table.c.created_at, table.c.id)).label('_n'),
                    func.count().over().label('_total')).where(*valid).subquery()
    stride = func.ceil((ranked.c._total - 1) / (limit - 1))
    return select(ranked).where(or_(ranked.c._total <= limit,
        ranked.c._n == ranked.c._total,
        (ranked.c._n - 1) % func.nullif(stride, 0) == 0)).order_by(ranked.c._n)


def payload(rows, source):
    result = []
    for row in rows:
        if source == 'location_wkb':
            point = wkb.loads(bytes(row['location_wkb'])) if row['location_wkb'] is not None else None
            lat, lng = (point.y, point.x) if point is not None else (None, None)
        else:
            lat, lng = row['latitude'], row['longitude']
        result.append({'id': row['id'], 'lat': float(lat) if lat is not None else None,
                       'lng': float(lng) if lng is not None else None,
                       'time': str(row['record_time'] or row['created_at']),
                       'created_at': str(row['created_at'])})
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--client-id', required=True)
    parser.add_argument('--start', type=datetime.fromisoformat)
    parser.add_argument('--end', type=datetime.fromisoformat)
    parser.add_argument('--days', type=int, default=30)
    parser.add_argument('--limit', type=int, default=1000)
    parser.add_argument('--repeats', type=int, default=30)
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    if not 2 <= args.limit <= 10000 or not 1 <= args.repeats <= 200 or not 1 <= args.days <= 90:
        parser.error('limit must be 2..10000, repeats 1..200, days 1..90')
    end = args.end or datetime.now(ZoneInfo("Asia/Taipei")).replace(tzinfo=None)
    start = args.start or end - timedelta(days=args.days)
    if not start < end or end - start > timedelta(days=90):
        parser.error('range must be positive and no longer than 90 days')
    _, url, _ = configuration(ROOT)
    engine = create_engine(url)
    if engine.dialect.name != 'postgresql':
        parser.error('requires the project PostgreSQL database')
    sources = ['current_all_columns', 'numeric_columns', 'location_xy', 'location_wkb']
    report = {'client_id': args.client_id, 'start': start.isoformat(), 'end': end.isoformat(),
              'repeats': args.repeats, 'limit': args.limit, 'results': {}}
    with engine.connect() as connection:
        connection.execute(text('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY'))
        connection.execute(text("SET LOCAL TIME ZONE 'Asia/Taipei'"))
        connection.execute(text("SET LOCAL statement_timeout = '15s'"))
        table = Table('gps_readings', MetaData(), autoload_with=connection)
        if 'location' not in table.c:
            parser.error('gps_readings.location is missing')
        for case in ['latest', 'trajectory']:
            queries = {source: query(table, source, args.client_id, start, end,
                       args.limit, latest=case == 'latest') for source in sources}
            baseline = None
            timings = {source: [] for source in sources}
            for source in sources:
                data = payload(connection.execute(queries[source]).mappings().all(), source)
                if baseline is None:
                    baseline = data
                if len(data) != len(baseline):
                    raise RuntimeError(f'{case}: row count differs for {source}')
                for a, b in zip(baseline, data):
                    if any(a[k] != b[k] for k in ['id', 'time', 'created_at']):
                        raise RuntimeError(f'{case}: row order/timestamps differ for {source}')
                    for key in ['lat', 'lng']:
                        if (a[key] is None) != (b[key] is None) or (a[key] is not None and abs(a[key] - b[key]) > 1e-9):
                            raise RuntimeError(f'{case}: coordinates differ for {source}; do not switch source')
            if not baseline:
                raise RuntimeError(f'{case}: no matching rows; choose another client or time range')
            for _ in range(args.repeats):
                order = sources.copy()
                random.shuffle(order)
                for source in order:
                    before = perf_counter()
                    rows = connection.execute(queries[source]).mappings().all()
                    converted = payload(rows, source)
                    json.dumps(converted, separators=(',', ':'))
                    timings[source].append((perf_counter() - before) * 1000)
            report['results'][case] = {'rows': len(baseline), 'coordinates_match': True,
                'variants': {source: {'median_ms': round(statistics.median(values), 3),
                            'p95_ms': round(sorted(values)[max(0, int(len(values) * .95 + .999) - 1)], 3),
                            'min_ms': round(min(values), 3)} for source, values in timings.items()}}
        connection.rollback()
    engine.dispose()
    rendered = json.dumps(report, indent=2, ensure_ascii=False)
    if args.output:
        args.output.write_text(rendered + '\n')
    print(rendered)


if __name__ == '__main__':
    main()
