"""Build a compact San Francisco basemap from the same Overture release."""
import sys
from pathlib import Path

from math import atan2, degrees

from shapely import box, make_valid
from shapely.geometry import mapping, shape
from shapely.ops import unary_union

from prepare import read_features, write_gzip

BOUNDS = box(-122.525, 37.704, -122.349, 37.837)
PRIMARY = {"primary", "motorway", "trunk", "secondary"}
STREET = PRIMARY | {"tertiary", "residential", "living_street", "unclassified", "pedestrian"}
GREEN = {"park", "protected", "grass", "golf", "forest"}
AREA_TYPES = {"Polygon", "MultiPolygon"}
INLAND_WATER = {"water", "lake", "pond", "reservoir", "river"}


def feature(geom, **properties):
    def round_coords(coordinates):
        if isinstance(coordinates[0], (float, int)):
            return [round(value, 5) for value in coordinates[:2]]
        return [round_coords(child) for child in coordinates]

    geometry = mapping(geom)
    geometry["coordinates"] = round_coords(geometry["coordinates"])
    return {"type": "Feature", "geometry": geometry, "properties": properties}


def feature_collection(features):
    return {"type": "FeatureCollection", "features": features}


def geometries(raw, theme, predicate):
    for item in read_features(raw, theme):
        if not predicate(item["properties"]):
            continue
        geom = shape(item["geometry"])
        if geom.geom_type not in AREA_TYPES or not geom.intersects(BOUNDS):
            continue
        cropped = make_valid(geom).intersection(BOUNDS).simplify(0.000025)
        if cropped.geom_type in AREA_TYPES and cropped.area > 0.000000015:
            yield cropped


def streets_and_labels(raw):
    roads, named = [], {}
    for item in read_features(raw, "segment"):
        params = item["properties"]
        if params.get("subtype") != "road" or params.get("class") not in STREET:
            continue
        geom = shape(item["geometry"]).intersection(BOUNDS).simplify(0.000025)
        if geom.geom_type not in {"LineString", "MultiLineString"} or geom.is_empty:
            continue
        major = params["class"] in PRIMARY
        roads.append(feature(geom, major=major))
        name = (params.get("names") or {}).get("primary")
        if not name or geom.length < 0.001 or geom.geom_type != "LineString":
            continue
        # Pick one reasonably long named segment per street per part of town.
        midpoint = geom.interpolate(0.5, normalized=True)
        key = (name, round(midpoint.x / 0.009), round(midpoint.y / 0.009))
        if key not in named or named[key][0].length < geom.length:
            named[key] = (geom, major, midpoint)

    labels = []
    for (name, _, _), (geom, major, midpoint) in sorted(named.items()):
        dx = geom.coords[-1][0] - geom.coords[0][0]
        dy = geom.coords[-1][1] - geom.coords[0][1]
        angle = degrees(atan2(-dy, dx))
        if angle > 90:
            angle -= 180
        elif angle < -90:
            angle += 180
        labels.append(feature(midpoint, name=name, major=major, angle=round(angle)))
    return roads, labels


def main(raw, output):
    coast = unary_union(list(geometries(raw, "land", lambda p: p.get("subtype") == "land")))
    if coast.is_empty:
        raise ValueError("No land polygons found in the extraction bounds")
    green = geometries(raw, "land_use", lambda p: p.get("subtype") in GREEN)
    inland = geometries(raw, "water", lambda p: p.get("subtype") in INLAND_WATER)
    areas = [feature(coast, kind="land")]
    areas.extend(feature(geom, kind="green") for geom in green)
    areas.extend(feature(geom, kind="water") for geom in inland)
    roads, labels = streets_and_labels(raw)
    write_gzip(output, {
        "areas": feature_collection(areas),
        "streets": feature_collection(roads),
        "labels": feature_collection(labels),
    })
    print(f"Basemap: {len(areas)} areas, {len(roads)} streets, {len(labels)} labels")


if __name__ == "__main__":
    main(Path(sys.argv[1]), Path(sys.argv[2]))
