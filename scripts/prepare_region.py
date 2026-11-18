"""Build the small-scale Bay Area layer. Street-level detail lives in basemap.pack."""
import sys
from pathlib import Path

from shapely import box, line_merge, make_valid
from shapely.geometry import MultiLineString, shape
from shapely.ops import unary_union

from prepare import read_features, write_gzip
from prepare_basemap import GREEN, feature, feature_collection

BOUNDS = box(-122.70, 37.50, -122.10, 38.00)


def areas(raw, theme, keep, minimum_area):
    polygons = []
    for item in read_features(raw, theme):
        if not keep(item["properties"].get("subtype")):
            continue
        geom = shape(item["geometry"])
        if geom.area < minimum_area:
            continue
        cropped = make_valid(geom).intersection(BOUNDS)
        if cropped.geom_type in {"Polygon", "MultiPolygon"} and cropped.area >= minimum_area:
            polygons.append(cropped.simplify(.00022))
    return unary_union(polygons).simplify(.0002)


def roads(raw):
    segments = []
    for item in read_features(raw, "segment"):
        props = item["properties"]
        if props.get("subtype") != "road" or props.get("class") not in {"motorway", "trunk", "primary"}:
            continue
        geom = shape(item["geometry"]).intersection(BOUNDS)
        if geom.geom_type == "LineString" and not geom.is_empty:
            segments.append(geom)
        elif geom.geom_type == "MultiLineString":
            segments.extend(geom.geoms)
    return line_merge(MultiLineString(segments)).simplify(.0002)


if __name__ == "__main__":
    raw = Path(sys.argv[1])
    land = areas(raw, "land", lambda kind: kind == "land", .000004)
    green = areas(raw, "land_use", GREEN.__contains__, .00009)
    write_gzip(Path(sys.argv[2]), feature_collection([
        feature(land, kind="land"), feature(green, kind="green"), feature(roads(raw), kind="road")
    ]))
