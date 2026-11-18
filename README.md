# Before You Sign

Before You Sign helps San Francisco renters compare up to five addresses by showing what they can walk to from each one.

Apartment listings tell you what's inside. I wanted to see what an ordinary Tuesday would look like outside: where I'd buy groceries, catch the bus, or get coffee. Enter a street address or choose **Surprise me** for two to compare. Add more from the map search bar. Tap an address card to switch the map, or open List for category counts and the shortest walks.

## Run it

Use Node 24.

```sh
npm ci
npm run dev
npm test
npm run build
```

The production build is in `dist/`. The city dataset and basemap ship with the repo. Running the app needs a static file server and no data credentials.

## How it fits together

- `src/ui/` contains address entry, filters, and the comparison panel.
- `src/map/` draws the local basemap, destinations, and routes in Leaflet.
- `src/routing/` finds reachable destinations and groups shared paths. A shared street segment gets one color, then the branches take the colors of the places they lead to.
- `scripts/` extracts and prepares the Overture data.

## Data and trade-offs

The app uses Overture's **2026-10-21.0** release for street addresses, destinations, transit infrastructure, and the walking network. The graph joins road segments by Overture connector IDs. Each address gets one bounded shortest-path search for the longest supported walk. Shorter limits and category changes reuse those results.

Walking estimates assume 80 meters per minute. Addresses and destinations snap to nearby graph connectors, and the estimate includes the distance to those connectors. Where the mapped street supports it, the map draws the final approach perpendicular to the street. Those short approaches are estimates, since the source data doesn’t consistently identify building entrances. The app excludes roads outside its pedestrian class allowlist and applies mapped foot access denials. It doesn't model hills, crossing delays, closures, or step-free access. Transit results show mapped stops and stations. Service and schedules are outside scope.

I kept the first city to San Francisco and the shortlist to five addresses. The map shows one address's routes at a time, while the other results stay in the comparison panel. There are no accounts, listings, overall scores, or live business hours. The city extract includes a simplified basemap derived from Overture streets, coastline, parks, and water. The static app has no runtime tile service or WebGL requirement.

To rebuild the city and basemap files with Python 3.12 or newer:

```sh
python -m venv .venv
source .venv/bin/activate
pip install -r scripts/requirements.txt
scripts/extract.sh
```

Map and routing data © OpenStreetMap contributors and Overture Maps Foundation. The derived walking network and basemap are distributed under the [Open Database License](https://opendatacommons.org/licenses/odbl/1-0/). Address and place data retain their [Overture source terms](https://docs.overturemaps.org/attribution/).
