"""Turn Overture features into compact address and walking graph files."""
import gzip
import json
import math
import sys
from collections import Counter
from pathlib import Path

from shapely import LineString, Point, STRtree
from shapely.ops import substring

LNG_METERS = 87_900
LAT_METERS = 111_100
MAX_ACCESS_METERS = 125
WALK_CLASSES = {
    "footway", "pedestrian", "steps", "path", "residential", "living_street",
    "service", "tertiary", "secondary", "primary", "unclassified", "track",
}
NO_WALK = {"denied", "private"}
LEAVE_UPPER = {"NW", "SW", "NE", "SE"}
TRANSIT_CLASSES = {
    "bus_stop": "Bus stop", "railway_station": "Rail station",
    "subway_station": "Subway station", "bus_station": "Bus station",
    "railway_halt": "Rail stop", "ferry_terminal": "Ferry terminal",
}


def read_features(directory, kind):
    with (directory / f"{kind}.jsonl").open() as source:
        for line in source:
            yield json.loads(line.lstrip("\x1e"))


def project(position):
    return position[0] * LNG_METERS, position[1] * LAT_METERS


def lonlat(position):
    return [round(position[0] / LNG_METERS, 6), round(position[1] / LAT_METERS, 6)]


def coordinate(feature):
    return [round(value, 6) for value in feature["geometry"]["coordinates"][:2]]


def walkable(props, start, end):
    if props.get("subtype") != "road" or props.get("class") not in WALK_CLASSES:
        return False
    for rule in props.get("access_restrictions") or []:
        modes = (rule.get("when") or {}).get("mode") or []
        lower, upper = rule.get("between") or [0, 1]
        if rule["access_type"] in NO_WALK and (not modes or "foot" in modes):
            if lower < end and upper > start:
                return False
    return True


def graph(directory):
    connectors = {item["id"]: coordinate(item) for item in read_features(directory, "connector")}
    nodes, edges, index = [], [], {}

    def node(connector):
        if connector not in index:
            index[connector] = len(nodes)
            nodes.append(connectors[connector])
        return index[connector]

    for feature in read_features(directory, "segment"):
        props = feature["properties"]
        if feature["geometry"]["type"] != "LineString" or props.get("class") not in WALK_CLASSES:
            continue
        line = LineString([project(point) for point in feature["geometry"]["coordinates"]])
        pairs = sorted(props.get("connectors") or [], key=lambda ref: ref["at"])
        for first, second in zip(pairs, pairs[1:]):
            start, end = first["connector_id"], second["connector_id"]
            if start == end or start not in connectors or end not in connectors:
                continue
            if not walkable(props, first["at"], second["at"]):
                continue
            # Project the actual shared points onto the line before slicing its shape.
            piece = substring(line, line.project(Point(project(connectors[start]))),
                              line.project(Point(project(connectors[end]))))
            meters = max(1, round(piece.length))
            interior = [lonlat(point) for point in list(piece.coords)[1:-1]]
            edges.append([node(start), node(end), meters, interior])
    return nodes, edges


def snapper(nodes):
    points = [Point(project(position)) for position in nodes]
    tree = STRtree(points)

    def snap(position):
        point = Point(project(position))
        index = int(tree.nearest(point))
        meters = round(point.distance(points[index]))
        return (index, meters) if meters <= MAX_ACCESS_METERS else None

    return snap


def category(props):
    taxonomy = props.get("taxonomy") or {}
    keys = set(taxonomy.get("hierarchy") or [])
    keys.update([props.get("basic_category"), taxonomy.get("primary")])
    if "grocery_store" in keys:
        return "groceries"
    if "pharmacy_and_drug_store" in keys:
        return "pharmacy"
    if "park" in keys:
        return "parks"
    if keys.intersection({"cafe", "coffee_shop"}):
        return "cafes"
    return None


def places(directory, snap):
    attributes = []
    for feature in read_features(directory, "place"):
        props = feature["properties"]
        kind = category(props)
        name = (props.get("names") or {}).get("primary")
        if kind and name and props.get("operating_status") not in {"permanently_closed", "temporarily_closed"}:
            attributes.append((kind, name, coordinate(feature)))

    for feature in read_features(directory, "infrastructure"):
        props = feature["properties"]
        kind = props.get("class")
        if props.get("subtype") == "transit" and kind in TRANSIT_CLASSES and feature["geometry"]["type"] == "Point":
            name = (props.get("names") or {}).get("primary") or TRANSIT_CLASSES[kind]
            attributes.append(("transit", name, coordinate(feature)))

    rows, seen = [], set()
    for kind, name, position in sorted(attributes):
        nearby = snap(position)
        if nearby is None:
            continue
        key = (kind, name.casefold(), *[round(value, 4) for value in position])
        if key not in seen:
            seen.add(key)
            rows.append([name, kind, position, *nearby])
    return rows


def addresses(directory, snap):
    by_label = {}
    for feature in read_features(directory, "address"):
        props = feature["properties"]
        levels = {str(item.get("value")).casefold() for item in props.get("address_levels") or []}
        if "san francisco" not in levels or not props.get("street") or not props.get("number"):
            continue
        street = " ".join(token if token in LEAVE_UPPER else token.title() for token in props["street"].split())
        label = f'{props["number"]} {street}'
        postal = props.get("postcode") or ""
        position = coordinate(feature)
        by_label.setdefault((label, postal), position)

    rows = []
    for (label, postal), position in sorted(by_label.items()):
        nearby = snap(position)
        if nearby is not None:
            rows.append([label, position, *nearby, postal])
    return rows


def write_gzip(path, payload):
    data = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode()
    path.write_bytes(gzip.compress(data, compresslevel=9, mtime=0))


def main(directory, output, release):
    nodes, edges = graph(directory)
    snap = snapper(nodes)
    destinations = places(directory, snap)
    home_addresses = addresses(directory, snap)
    output.mkdir(parents=True, exist_ok=True)
    write_gzip(output / "network.pack", {
        "release": release, "nodes": nodes, "edges": edges, "places": destinations,
    })
    write_gzip(output / "addresses.pack", home_addresses)
    print(f"{len(home_addresses):,} addresses, {len(nodes):,} connectors, {len(edges):,} walking edges")
    print(dict(Counter(item[1] for item in destinations)))


if __name__ == "__main__":
    main(Path(sys.argv[1]), Path(sys.argv[2]), sys.argv[3])
