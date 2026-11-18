# Before You Sign

Before You Sign helps San Francisco renters compare up to five addresses by showing what they can walk to from each one.

Apartment listings tell you what’s inside. I wanted to see what an ordinary Tuesday would look like outside. How far would I walk for groceries, coffee, or the bus? Enter an address or choose **Surprise me** for two to compare. Pick a category and walking limit, then switch between addresses to see what changes.

## Run it

Use Node 24.

```sh
npm ci
npm run dev
npm test
npm run build
```

The production build is in `dist/`. It can be served by a static host and needs no environment variables or API keys. For Cloudflare Pages, use `npm run build` and publish `dist`.

## Where the data comes from

`scripts/extract.sh` uses the Overture Maps CLI to download geographic slices from the **2026-10-21.0** release. The preparation scripts turn those slices into compressed files in `src/assets/` for the addresses, places, pedestrian network, and basemap. The network joins road segments using Overture connector IDs.

The app serves those files as static assets from the same host as the site. During the splash, the map and comparison data load in parallel and a browser worker prepares the address index. Address search and walking routes run in the browser. The app makes no live calls to Overture. Vite fingerprints the assets and the included Cloudflare Pages headers set long-lived caching for them.

## Trade-offs and cuts

- Search and comparison cover San Francisco. A simplified Bay Area overview provides context when zoomed out.
- Each home gets one bounded shortest-path search. Shorter walk limits and category filters reuse its results. The map shows one home’s routes at a time to keep them readable.
- Walk times use 80 meters per minute and include estimated links from addresses and destinations to the walking network. They don’t account for hills, crossings, closures, or step-free access. Transit shows mapped stops and stations. Live schedules and opening hours are outside scope.
- The bundled data is about 5.9 MB compressed. The snapshot keeps the app self-contained and requires a new extract to refresh.

## Rebuild the data

Use Python 3.12 or newer. The prepared files are already included for normal builds.

```sh
python -m venv .venv
source .venv/bin/activate
pip install -r scripts/requirements.txt
scripts/extract.sh
```

Map and routing data © OpenStreetMap contributors and Overture Maps Foundation. The derived walking network and basemap are distributed under the [Open Database License](https://opendatacommons.org/licenses/odbl/1-0/). Address and place data retain their [Overture source terms](https://docs.overturemaps.org/attribution/).
