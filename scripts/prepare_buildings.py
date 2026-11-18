"""Write Overture footprints in small Web Mercator tiles for neighborhood zooms."""
import math
import sys
from collections import defaultdict
from pathlib import Path

from prepare import read_features, write_gzip

ZOOM = 13
EXTENT = 4096
WORLD = (2 ** ZOOM) * EXTENT


def project(point):
    lon, lat = point[:2]
    return (round((lon + 180) / 360 * WORLD),
            round((1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * WORLD))


def encode(rings, col, row):
    paths = []
    for ring in rings:
        x, y = ring[0]
        path = [f"M{x - col * EXTENT} {y - row * EXTENT}l"]
        for nx, ny in ring[1:-1]:
            if (x, y) != (nx, ny):
                path.append(f"{nx-x} {ny-y} ")
                x, y = nx, ny
        if len(path) >= 3:
            paths.append("".join(path).rstrip() + "Z")
    return "".join(paths)


def main(raw, output):
    tiles = defaultdict(list)
    for item in read_features(raw, "building"):
        geom = item["geometry"]
        if geom["type"] not in {"Polygon", "MultiPolygon"}:
            continue
        polygons = geom["coordinates"] if geom["type"] == "MultiPolygon" else [geom["coordinates"]]
        for polygon in polygons:
            rings = [[project(point) for point in ring] for ring in polygon]
            xs, ys = zip(*rings[0])
            for col in range(min(xs) // EXTENT, max(xs) // EXTENT + 1):
                for row in range(min(ys) // EXTENT, max(ys) // EXTENT + 1):
                    tiles[col, row].append(encode(rings, col, row))
    output.mkdir(parents=True, exist_ok=True)
    for (col, row), paths in tiles.items():
        write_gzip(output / f"{col}-{row}.pack", "".join(paths))


if __name__ == "__main__":
    main(Path(sys.argv[1]), Path(sys.argv[2]))
