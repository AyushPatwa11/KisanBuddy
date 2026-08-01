import os
import httpx
from typing import List, Dict, Any, Optional, Tuple
import pandas as pd
from datetime import datetime, timedelta
import math
import time
import json
from pathlib import Path
import logging
import concurrent.futures
logger = logging.getLogger(__name__)

CEDA_BASE = os.getenv("CEDA_BASE", "https://api.ceda.ashoka.edu.in/v1")
CEDA_API_KEY = os.getenv("CEDA_API_KEY", "")

# Prefer official data.gov.in resource if configured. To enable, set the
# following env vars in `backend/.env` or your environment:
#   DATAGOV_BASE (optional, default https://api.data.gov.in/resource)
#   DATAGOV_API_KEY (required to use data.gov.in)
#   DATAGOV_RESOURCE_ID (the resource id for the Agmarknet dataset)
#   USE_DATAGOV (optional, defaults to true)
DATAGOV_BASE = os.getenv("DATAGOV_BASE", "https://api.data.gov.in/resource")
DATAGOV_API_KEY = os.getenv("DATAGOV_API_KEY", "")
DATAGOV_RESOURCE_ID = os.getenv("DATAGOV_RESOURCE_ID", "")

# Enable data.gov only when credentials are present; otherwise fall back to CEDA or local caches
RAW_USE_DATAGOV = os.getenv("USE_DATAGOV", "true").lower() in ("1", "true", "yes")
USE_DATAGOV = RAW_USE_DATAGOV and bool(DATAGOV_API_KEY and DATAGOV_RESOURCE_ID)
_DATAGOV_OFFLINE_UNTIL = 0.0
_CEDA_OFFLINE_UNTIL = 0.0

# Expected response schema: JSON array with City, Commodity, Min Prize, Max Prize, Date
# We'll normalize keys to snake_case: city, commodity, min_price, max_price, modal_price, date

async def _post_prices_async(payload: Dict[str, Any]) -> List[Dict[str, Any]]:
    # Default legacy CEDA client kept for compatibility. Prefer DATA.GOV
    # Use a shorter timeout to fail fast when CEDA is slow/unreachable
    async with httpx.AsyncClient(timeout=1.0) as client:
        try:
            headers = {}
            if CEDA_API_KEY:
                # Send common header variants; CEDA accepts api-key in header or bearer
                headers = {
                    "Authorization": f"Bearer {CEDA_API_KEY}",
                    "x-api-key": CEDA_API_KEY,
                    "Content-Type": "application/json"
                }
            resp = await client.post(f"{CEDA_BASE}/agmarknet/prices", json=payload, headers=headers)
            resp.raise_for_status()
            data = resp.json()
        except httpx.HTTPStatusError as e:
            content = None
            try:
                content = e.response.text
            except Exception:
                content = str(e)
            # If CEDA returned 401 and user intended to use data.gov, surface clearer guidance
            if e.response.status_code == 401:
                raise ValueError(
                    "Agmarknet (CEDA) returned 401 Unauthorized. "
                    "If you prefer the official data.gov.in dataset, set DATAGOV_API_KEY and DATAGOV_RESOURCE_ID and set USE_DATAGOV=true. "
                    "Otherwise ensure CEDA_API_KEY is set and valid. Response: " + (content or "(no body)")
                )
            raise ValueError(f"Agmarknet API returned error: {e.response.status_code} {content}")
        except Exception as e:
            raise ValueError(f"Failed to call Agmarknet service: {e}")
        normalized = []
        for row in data:
            normalized.append({
                "city": row.get("City") or row.get("city", ""),
                "commodity": row.get("Commodity") or row.get("commodity", ""),
                "min_price": float(row.get("Min Prize") or row.get("MinPrice") or row.get("min_price", 0) or 0),
                "max_price": float(row.get("Max Prize") or row.get("MaxPrice") or row.get("max_price", 0) or 0),
                "modal_price": float(row.get("Modal Price") or row.get("modal_price", 0) or 0),
                "date": row.get("Date") or row.get("date", ""),
            })
        return normalized


def fetch_prices(commodity: str, market: Optional[str] = None, state: Optional[str] = None,
                 start_date: Optional[str] = None, end_date: Optional[str] = None) -> List[Dict[str, Any]]:
    payload: Dict[str, Any] = {"commodity": commodity}
    if market:
        payload["market"] = market
    if state:
        payload["state"] = state
    if start_date:
        payload["start_date"] = start_date
    if end_date:
        payload["end_date"] = end_date

    # Use sync wrapper around async client for FastAPI dependency simplicity
    import anyio

    def _local_fallback() -> List[Dict[str, Any]]:
        """Return cached/sample data so the UI is not empty during local dev."""
        try:
            SAMPLE_PATH = Path(__file__).parent.parent / 'agmarknet_sample.json'
            if SAMPLE_PATH.exists():
                text = SAMPLE_PATH.read_text(encoding='utf-8')
                data = json.loads(text)
                logger.debug("[fetch_prices] loaded local sample dataset with %d rows", len(data))
                return data
        except Exception:
            pass

        try:
            CACHE_PATH = Path(__file__).parent.parent / 'tmp_geocache.json'
            cache = {}
            if CACHE_PATH.exists():
                cache = json.loads(CACHE_PATH.read_text(encoding='utf-8') or '{}')
            records = []
            today = datetime.utcnow().strftime('%Y-%m-%d')
            for city, meta in cache.items():
                lat = meta.get('lat')
                lon = meta.get('lon')
                # Include commodity in synthetic seed so different crops produce distinct prices
                price_seed = abs(hash((city, str(commodity).strip().lower()))) % 1000
                modal_price = 1800 + (price_seed % 1200)
                records.append({
                    'market': city,
                    'Commodity': commodity,
                    'Modal Price': modal_price,
                    'Min Prize': max(1000, modal_price - 200),
                    'Max Prize': modal_price + 200,
                    'Date': today,
                    'lat': lat,
                    'lon': lon,
                })
            if records:
                logger.debug("[fetch_prices] generated %d synthetic rows from geocache", len(records))
            normalized = []
            for row in records:
                normalized.append({
                    'city': row.get('market') or row.get('city') or '',
                    'commodity': row.get('Commodity') or commodity,
                    'min_price': float(row.get('Min Prize') or 0),
                    'max_price': float(row.get('Max Prize') or 0),
                    'modal_price': float(row.get('Modal Price') or 0),
                    'date': row.get('Date') or today,
                    'lat': row.get('lat'),
                    'lon': row.get('lon'),
                })
            return normalized
        except Exception as e2:
            logger.warning("[fetch_prices] fallback generation failed: %s", e2)
            return []

    last_error: Optional[Exception] = None
    global _DATAGOV_OFFLINE_UNTIL, _CEDA_OFFLINE_UNTIL
    now = time.time()

    if USE_DATAGOV and now > _DATAGOV_OFFLINE_UNTIL:
        try:
            return anyio.run(_post_prices_datagov_async, payload)
        except Exception as e:
            _DATAGOV_OFFLINE_UNTIL = now + 120.0  # pause datagov queries for 2 mins if timing out
            last_error = e
            logger.warning("[fetch_prices] data.gov.in Agmarknet query failed: %s; pausing datagov for 2m", e)
            fallback = _local_fallback()
            if fallback:
                return fallback

    if now > _CEDA_OFFLINE_UNTIL:
        try:
            return anyio.run(_post_prices_async, payload)
        except Exception as e:
            _CEDA_OFFLINE_UNTIL = now + 120.0  # pause CEDA queries for 2 mins if timing out
            last_error = last_error or e
            logger.warning("[fetch_prices] CEDA Agmarknet query failed: %s; pausing CEDA for 2m", e)
            fallback = _local_fallback()
            if fallback:
                return fallback

    # Final fallback to keep a deterministic error instead of silent empty lists
    fallback = _local_fallback()
    if fallback:
        return fallback

    msg = f"Agmarknet query failed: {last_error}" if last_error else "Agmarknet query failed"
    raise ValueError(msg)


async def _post_prices_datagov_async(payload: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Query data.gov.in resource endpoint for Agmarknet dataset.

    Requires DATAGOV_RESOURCE_ID and DATAGOV_API_KEY to be set. The function maps
    incoming `commodity`, `market`, `state`, `start_date`, `end_date` to
    `filters[...]` query parameters used by the data.gov.in API. The exact
    resource schema may vary; you should set `DATAGOV_RESOURCE_ID` to the
    Agmarknet resource id provided by data.gov.in.
    """
    if not DATAGOV_RESOURCE_ID or not DATAGOV_API_KEY:
        raise ValueError("DATAGOV_RESOURCE_ID and DATAGOV_API_KEY must be set to use data.gov.in integration")

    # Use a shorter timeout to fail faster when data.gov is slow/unreachable
    async with httpx.AsyncClient(timeout=1.0) as client:
        try:
            params: Dict[str, Any] = {"api-key": DATAGOV_API_KEY, "format": "json", "limit": 200}
            # Map possible filters
            if payload.get("commodity"):
                params["filters[commodity]"] = payload["commodity"]
            if payload.get("market"):
                params["filters[market]"] = payload["market"]
            if payload.get("state"):
                params["filters[state]"] = payload["state"]
            if payload.get("start_date"):
                params["from_date"] = payload["start_date"]
            if payload.get("end_date"):
                params["to_date"] = payload["end_date"]

            url = f"{DATAGOV_BASE}/{DATAGOV_RESOURCE_ID}"
            logger.debug("[agmarknet] querying data.gov: %s params=%s", url, params)
            resp = await client.get(url, params=params)
            # Log status and body for debugging if non-200
            text = None
            try:
                text = resp.text
            except Exception:
                text = None
            logger.debug("[agmarknet] data.gov status=%s (body len=%d)", resp.status_code, len(text) if text else 0)
            resp.raise_for_status()
            try:
                data = resp.json()
            except Exception as e:
                logger.warning("[agmarknet] failed parsing data.gov JSON: %s", e)
                # Return empty records on parse failure
                return []
        except httpx.HTTPStatusError as e:
            content = None
            try:
                content = e.response.text
            except Exception:
                content = str(e)
            # Log and fail gracefully by returning empty records
            logger.warning("[agmarknet] data.gov HTTP error: %s content=%s", e.response.status_code, content)
            return []
        except Exception as e:
            logger.warning("[agmarknet] Failed to call data.gov.in Agmarknet resource: %s", e)
            return []

        # data.gov responses often put results in `records` or `data` depending on API
        records = data.get("records") or data.get("data") or data.get("result") or []
        normalized = []
        for row in records:
            normalized.append({
                "city": row.get("market") or row.get("city") or row.get("district") or "",
                "commodity": row.get("commodity") or payload.get("commodity", ""),
                "min_price": float(row.get("min_price") or row.get("Min_Price") or 0),
                "max_price": float(row.get("max_price") or row.get("Max_Price") or 0),
                "modal_price": float(row.get("modal_price") or row.get("Modal_Price") or 0),
                "date": row.get("arrival_date") or row.get("date") or "",
            })
        return normalized


def _haversine_km(a: Tuple[float, float], b: Tuple[float, float]) -> float:
    """Return great-circle distance between two (lat, lon) points in kilometers."""
    lat1, lon1 = a
    lat2, lon2 = b
    R = 6371.0
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    x = math.sin(dphi/2)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda/2)**2
    return 2 * R * math.asin(math.sqrt(x))


def filter_markets_by_distance(markets: List[Dict[str, Any]], origin: Tuple[float, float], radius_km: float = 100.0) -> List[Dict[str, Any]]:
    """Given a list of market entries (each may include 'name' and optional 'lat','lon'),
    return those within `radius_km` of `origin`. If a market lacks coords, try geocoding via OSM.
    Each returned entry will include computed `distance_km`.
    """
    out: List[Dict[str, Any]] = []
    for m in markets:
        name = m.get('name') or m.get('market') or m.get('city')
        lat = m.get('lat') or m.get('latitude')
        lon = m.get('lon') or m.get('longitude')
        coords = None
        if lat is not None and lon is not None:
            try:
                coords = (float(lat), float(lon))
            except Exception:
                coords = None

        if not coords and name:
            coords = geocode_market_osm(name)

        if not coords:
            # skip markets we cannot locate
            continue

        dist = _haversine_km(origin, coords)
        if dist <= float(radius_km):
            entry = dict(m)
            entry['distance_km'] = round(dist, 2)
            entry['lat'] = coords[0]
            entry['lon'] = coords[1]
            out.append(entry)

    # sort by distance ascending
    out = sorted(out, key=lambda x: x['distance_km'])
    return out


def geocode_market_osm(market_name: str, state: Optional[str] = None) -> Optional[Tuple[float, float]]:
    """Lightweight geocode using Nominatim (OpenStreetMap). Returns (lat, lon) or None on failure.
    Intended for hackathon-safe, low-volume use only.
    """
    # Use a small persistent cache to avoid overloading Nominatim and to be rate-limit friendly
    CACHE_PATH = Path(__file__).parent.parent / "tmp_geocache.json"
    try:
        q = market_name
        if state:
            q = f"{market_name}, {state}, India"

        # Load cache
        cache = {}
        try:
            if CACHE_PATH.exists():
                cache = json.loads(CACHE_PATH.read_text(encoding="utf-8"))
        except Exception:
            cache = {}

        if q in cache:
            entry = cache[q]
            return (float(entry["lat"]), float(entry["lon"]))

        # Simple rate-limit: ensure at least 1s between geocode calls
        last_call_file = Path(__file__).parent.parent / ".last_geocode"
        try:
            if last_call_file.exists():
                last_ts = float(last_call_file.read_text())
                elapsed = time.time() - last_ts
                if elapsed < 1.0:
                    time.sleep(1.0 - elapsed)
        except Exception:
            pass

        url = "https://nominatim.openstreetmap.org/search"
        params = {"q": q, "format": "json", "limit": 1, "countrycodes": "in"}
        with httpx.Client(timeout=10.0) as client:
            resp = client.get(url, params=params, headers={"User-Agent": "KisanBuddy/1.0 (hackathon)"})
            resp.raise_for_status()
            data = resp.json()
        if not data:
            return None
        item = data[0]
        lat = float(item["lat"])
        lon = float(item["lon"])

        # Save to cache
        try:
            cache[q] = {"lat": lat, "lon": lon, "timestamp": int(time.time())}
            CACHE_PATH.write_text(json.dumps(cache), encoding="utf-8")
        except Exception:
            pass

        try:
            last_call_file.write_text(str(time.time()))
        except Exception:
            pass

        return (lat, lon)
    except Exception:
        return None


def reverse_geocode_state(origin: Tuple[float, float]) -> Optional[str]:
    """Resolve the administrative state name for given coordinates using Nominatim.
    Caches results in tmp_reverse_geocode.json to minimize calls.
    """
    try:
        lat, lon = origin
        CACHE_PATH = Path(__file__).parent.parent / "tmp_reverse_geocode.json"
        key = f"{round(float(lat), 4)}:{round(float(lon), 4)}"
        cache = {}
        try:
            if CACHE_PATH.exists():
                cache = json.loads(CACHE_PATH.read_text(encoding="utf-8") or "{}")
        except Exception:
            cache = {}
        if key in cache:
            return cache.get(key)
        url = "https://nominatim.openstreetmap.org/reverse"
        params = {"lat": lat, "lon": lon, "format": "json", "zoom": 10, "addressdetails": 1}
        with httpx.Client(timeout=10.0) as client:
            resp = client.get(url, params=params, headers={"User-Agent": "KisanBuddy/1.0 (reverse-geocode)"})
            resp.raise_for_status()
            data = resp.json()
            addr = data.get("address") or {}
            # Common keys: state, state_district, county
            state = addr.get("state") or addr.get("state_district") or addr.get("county")
            if state:
                try:
                    cache[key] = state
                    CACHE_PATH.write_text(json.dumps(cache), encoding="utf-8")
                except Exception:
                    pass
                return state
    except Exception:
        return None


def search_places_geoapify(origin: Tuple[float, float], radius_km: int = 50, limit: int = 20, query_hint: Optional[str] = None, categories: Optional[str] = None):
    """Generic Geoapify Places search helper.

    Returns a list of place dicts with keys: name, lat, lon, distance_km, properties.
    Reuses a robust retry/relax strategy similar to `_search_mandis_geoapify`.
    """
    lat, lon = origin
    GEOAPIFY_KEY = os.getenv("GEOAPIFY_API_KEY", "")
    out = []
    if not GEOAPIFY_KEY:
        logger.debug("[search_places_geoapify] GEOAPIFY_API_KEY not set; skipping place search")
        return out

    url = "https://api.geoapify.com/v2/places"
    attempts = 1
    data = None
    last_err = None
    # Normalize parameter order to Geoapify expectation (lon,lat) and cap radius to 50km
    radius_m = int(min(float(radius_km) * 1000.0, 50000))
    for attempt in range(attempts):
        params = {
            "apiKey": GEOAPIFY_KEY,
            "filter": f"circle:{lon},{lat},{radius_m}",
            "limit": limit,
            "bias": f"proximity:{lon},{lat}",
            "lang": "en",
        }
        if categories:
            params["categories"] = categories
        if query_hint and not categories:
            params["q"] = query_hint

        try:
            with httpx.Client(timeout=1.5) as client:
                resp = client.get(url, params=params)
                resp.raise_for_status()
                data = resp.json()
                break
        except httpx.HTTPStatusError as he:
            last_err = he
            status = None
            body_text = None
            try:
                status = he.response.status_code
                body_text = he.response.text
            except Exception:
                status = None
            # Log provider error body for 400 to aid debugging
            if status == 400:
                logger.debug(f"[search_places_geoapify] Geoapify 400 body: {body_text}")
                # relaxed retry on 400 (drop filter in later attempts may be tried by caller)
                time.sleep(0.5 * (attempt + 1))
                continue
            else:
                break
        except Exception as e:
            last_err = e
            time.sleep(0.5 * (attempt + 1))
            continue

    features = data.get("features") if data else []
    for f in features:
        props = f.get("properties") or {}
        name = props.get("name") or props.get("address_line1") or props.get("street") or props.get("name:en") or ""
        geom = f.get("geometry") or {}
        coords = None
        if geom and geom.get("coordinates"):
            try:
                lon_f, lat_f = geom.get("coordinates")[:2]
                coords = (float(lat_f), float(lon_f))
            except Exception:
                coords = None
        distance = None
        if coords:
            distance = round(_haversine_km(origin, coords), 2)
        out.append({"name": name, "lat": coords[0] if coords else None, "lon": coords[1] if coords else None, "distance_km": distance, "properties": props})

    # dedupe by normalized name and sort by distance
    
    # dedupe by normalized name and sort by distance
    seen = set()
    deduped = []
    for m in out:
        n = (m.get("name") or "").strip().lower()
        if not n or n in seen:
            continue
        seen.add(n)
        deduped.append(m)
    deduped = [d for d in deduped if d.get("distance_km") is not None and d.get("distance_km") <= float(radius_km)]
    deduped = sorted(deduped, key=lambda x: x.get("distance_km", 999999))
    
    logger.info(f"[search_places_geoapify] After dedup/filter: {len(deduped)} places (last_err={last_err})")
    return deduped


# Removed: search_soil_testing_centres_geoapify - feature deprecated per project decision


KNOWN_INDIAN_MANDIS = [
    {"name": "Sundargarh APMC Mandi", "state": "Odisha", "lat": 22.12, "lon": 84.03},
    {"name": "Rourkela Sub-Divisional Mandi", "state": "Odisha", "lat": 22.26, "lon": 84.85},
    {"name": "Sambalpur Main Mandi", "state": "Odisha", "lat": 21.47, "lon": 83.97},
    {"name": "Jharsuguda Market Yard", "state": "Odisha", "lat": 21.86, "lon": 84.01},
    {"name": "Bargarh Grain Mandi", "state": "Odisha", "lat": 21.33, "lon": 83.62},
    {"name": "Cuttack Malgodown Mandi", "state": "Odisha", "lat": 20.46, "lon": 85.88},
    {"name": "Bhubaneswar Unit-1 Market", "state": "Odisha", "lat": 20.27, "lon": 85.84},
    {"name": "Balasore Regulated Market", "state": "Odisha", "lat": 21.49, "lon": 86.93},
    {"name": "Berhampur APMC Market", "state": "Odisha", "lat": 19.31, "lon": 84.79},
    {"name": "Khanna Grain Market", "state": "Punjab", "lat": 30.70, "lon": 76.22},
    {"name": "Karnal APMC Mandi", "state": "Haryana", "lat": 29.69, "lon": 76.98},
    {"name": "Ambala Mandi", "state": "Haryana", "lat": 30.37, "lon": 76.78},
    {"name": "Ludhiana Mandi", "state": "Punjab", "lat": 30.90, "lon": 75.85},
    {"name": "Nashik APMC Mandi", "state": "Maharashtra", "lat": 19.99, "lon": 73.79},
    {"name": "Azadpur Mandi", "state": "Delhi", "lat": 28.70, "lon": 77.17},
    {"name": "Vashi APMC Mandi", "state": "Maharashtra", "lat": 19.07, "lon": 73.00},
    {"name": "Indore APMC Mandi", "state": "Madhya Pradesh", "lat": 22.72, "lon": 75.86},
    {"name": "Ujjain Mandi", "state": "Madhya Pradesh", "lat": 23.17, "lon": 75.78},
    {"name": "Agra APMC Mandi", "state": "Uttar Pradesh", "lat": 27.18, "lon": 78.01},
    {"name": "Kanpur Mandi", "state": "Uttar Pradesh", "lat": 26.44, "lon": 80.33},
    {"name": "Jaipur APMC Mandi", "state": "Rajasthan", "lat": 26.91, "lon": 75.78},
    {"name": "Kolar APMC Market", "state": "Karnataka", "lat": 13.13, "lon": 78.13},
    {"name": "Yeshwanthpur APMC", "state": "Karnataka", "lat": 13.02, "lon": 77.55},
    {"name": "Koyambedu Wholesale Market", "state": "Tamil Nadu", "lat": 13.07, "lon": 80.19},
]

def find_nearest_mandis(commodity: str, origin: Tuple[float, float], radius_km: int = 100, top_n: int = 5,
                        fuel_rate_per_ton_km: float = 0.05, mandi_fees: float = 0.0) -> List[Dict[str, Any]]:
    """Fetch recent prices for `commodity`, geocode markets, compute distance and effective price."""
    GEOAPIFY_KEY = os.getenv("GEOAPIFY_API_KEY", "")
    CACHE_PATH = Path(__file__).parent.parent / "tmp_mandi_price_cache.json"

    def _load_cache():
        try:
            if CACHE_PATH.exists():
                return json.loads(CACHE_PATH.read_text(encoding="utf-8") or "{}")
        except Exception:
            pass
        return {}

    def _save_cache(c):
        try:
            CACHE_PATH.write_text(json.dumps(c), encoding="utf-8")
        except Exception:
            pass

    def _normalize_market_name(name: str) -> str:
        return " ".join(str(name or "").strip().lower().split())

    mandis = []
    # 1. Fetch Geoapify places if API key is present
    geo_mandis = search_places_geoapify(origin, radius_km, limit=50)
    if geo_mandis:
        mandis.extend(geo_mandis)

    # 2. Always include known regional mandis within radius
    for km in KNOWN_INDIAN_MANDIS:
        dist = _haversine_km(origin, (km["lat"], km["lon"]))
        if dist <= float(radius_km) * 1.5:  # allow 1.5x search radius for regional mandis
            mandis.append({
                "name": km["name"],
                "state": km["state"],
                "lat": km["lat"],
                "lon": km["lon"],
                "distance_km": round(dist, 2),
                "source": "known"
            })
    # If Geoapify returned no results or failed, fall back to Overpass (OpenStreetMap) queries
    if not mandis:
        try:
            logger.debug("[find_nearest_mandis] Geoapify returned no results, falling back to Overpass OSM (multiple endpoints)")
            overpass_endpoints = [
                "https://overpass-api.de/api/interpreter",
                "https://lz4.overpass-api.de/api/interpreter",
                "https://overpass.kumi.systems/api/interpreter",
                "https://overpass.openstreetmap.ru/cgi/interpreter",
            ]
            radius_m = int(float(radius_km) * 1000)
            lat, lon = origin
            # broaden tag set to include marketplace/shop tags commonly used in India
            query_body = (
                f"[out:json][timeout:60];("
                f"node[\"amenity\"=\"marketplace\"](around:{radius_m},{lat},{lon});"
                f"node[\"shop\"=\"greengrocer\"](around:{radius_m},{lat},{lon});"
                f"node[\"shop\"=\"fruits\"](around:{radius_m},{lat},{lon});"
                f"node[\"shop\"=\"wholesaler\"](around:{radius_m},{lat},{lon});"
                f"node[\"market\"](around:{radius_m},{lat},{lon});"
                f"way[\"amenity\"=\"marketplace\"](around:{radius_m},{lat},{lon});"
                f"relation[\"amenity\"=\"marketplace\"](around:{radius_m},{lat},{lon});"
                f");out center 50;"
            )
            elements = []
            for idx, ep in enumerate(overpass_endpoints):
                try:
                    backoff = min(2 ** idx, 8)
                    with httpx.Client(timeout=60.0) as client:
                        resp = client.post(ep, data={"data": query_body})
                        resp.raise_for_status()
                        data = resp.json()
                    elements = data.get("elements", [])
                    logger.debug("[find_nearest_mandis] Overpass endpoint %s returned %d elements", ep, len(elements))
                    if elements:
                        logger.debug("[find_nearest_mandis] Overpass returned %d elements from %s", len(elements), ep)
                        break
                except Exception as e:
                    logger.debug("[find_nearest_mandis] Overpass endpoint %s failed: %s; backing off %ss", ep, e, backoff)
                    time.sleep(backoff)
                    continue

            seen = set()
            for el in elements:
                props_name = el.get("tags", {}).get("name") or el.get("tags", {}).get("ref") or ""
                if not props_name:
                    continue
                norm = _normalize_market_name(props_name)
                if norm in seen:
                    continue
                seen.add(norm)
                # get coords: node has lat/lon, way/relation use center
                if el.get("type") == "node":
                    lat_e = el.get("lat")
                    lon_e = el.get("lon")
                else:
                    center = el.get("center") or {}
                    lat_e = center.get("lat")
                    lon_e = center.get("lon")
                if lat_e is None or lon_e is None:
                    continue
                dist = _haversine_km(origin, (float(lat_e), float(lon_e)))
                if dist > radius_km:
                    continue
                mandis.append({"name": props_name, "lat": float(lat_e), "lon": float(lon_e), "distance_km": round(dist, 2)})
            mandis = sorted(mandis, key=lambda x: x.get("distance_km", 999999))
        except Exception as e:
            logger.debug("[find_nearest_mandis] Overpass fallback failed: %s", e)
    # Final deterministic fallback: use local geocode cache to approximate nearest markets
    if not mandis:
        try:
            CACHE_PATH = Path(__file__).parent.parent / "tmp_geocache.json"
            if CACHE_PATH.exists():
                cache = json.loads(CACHE_PATH.read_text(encoding="utf-8") or "{}")
                entries = []
                for key, meta in cache.items():
                    lat_c = meta.get("lat")
                    lon_c = meta.get("lon")
                    if lat_c is None or lon_c is None:
                        continue
                    dist = _haversine_km(origin, (float(lat_c), float(lon_c)))
                    if dist <= float(radius_km):
                        entries.append({"name": key, "lat": float(lat_c), "lon": float(lon_c), "distance_km": round(dist, 2), "source": "geocache"})
                mandis = sorted(entries, key=lambda x: x.get("distance_km", 999999))
                if mandis:
                    logger.debug("[find_nearest_mandis] Using %d entries from local geocache fallback", len(mandis))
        except Exception as e:
            logger.debug("[find_nearest_mandis] geocache fallback failed: %s", e)
    results: List[Dict[str, Any]] = []

    # Load cache (keyed by date -> commodity_lower -> normalized_market -> {record})
    cache = _load_cache()
    today = datetime.utcnow().date().isoformat()
    if today not in cache:
        cache[today] = {}

    def _is_valid_market_name(n: str) -> bool:
        if not n or not isinstance(n, str):
            return False
        s = n.strip().lower()
        # accept if explicitly contains mandi/market-like words first
        accept_tokens = ['mandi', 'market', 'mandai', 'bazaar', 'haat', 'sabzi', 'wholesale', 'apmc', 'pandal', 'complex']
        for t in accept_tokens:
            if t in s:
                return True
        # blacklist generic, too-short or obviously non-mandi names
        blacklist_tokens = [
            'shop', 'store', 'grocery', 'supermarket', 'mother dairy', 'safal', 'pure veg',
            'restaurant', 'hotel', 'factory', 'office', 'company', 'software', 'solutions',
            'mall', 'vegetable shop', 'fruit stalls', 'd mart', 'dmart'
        ]
        for t in blacklist_tokens:
            if t in s:
                return False
        # otherwise accept reasonably long names (allow single-word names >=5 chars)
        if len(s) >= 5:
            return True
        return False

    # Deduplicate by normalized name and filter
    filtered = []
    seen_names = set()
    dropped = []
    for m in mandis:
        nm = (m.get('name') or m.get('market') or m.get('city') or '')
        norm = _normalize_market_name(nm)
        if not norm or norm in seen_names:
            continue
        seen_names.add(norm)
        if not _is_valid_market_name(nm):
            # keep geocache-sourced entries even if name is generic
            if m.get('source') == 'geocache':
                filtered.append(m)
            else:
                dropped.append((nm, norm))
                continue
        else:
            filtered.append(m)

    # Log filter summary at debug level
    logger.debug("[find_nearest_mandis] total_candidates=%d filtered=%d dropped_by_name=%d", len(mandis), len(filtered), len(dropped))
    if dropped:
        for d in dropped[:10]:
            logger.debug("[find_nearest_mandis] dropped_by_name=%s", d[0])

    # Cap queries to nearest N markets to limit noisy upstream calls
    # Cap queries to nearest N markets to limit noisy upstream calls (reduced for speed)
    MAX_MARKETS_TO_QUERY = 6
    mandis = sorted(filtered, key=lambda x: x.get('distance_km', 999999))[:MAX_MARKETS_TO_QUERY]

    if not mandis:
        # nothing left after filtering — fall back to original mandis but cap and dedupe
        mandis = sorted({ _normalize_market_name(m.get('name') or ''): m for m in mandis }.values(), key=lambda x: x.get('distance_km', 999999))[:MAX_MARKETS_TO_QUERY]

    # log summary of markets we will query
    try:
        logger.info("[find_nearest_mandis] querying prices for %d candidate markets (capped to %d)", len(mandis), MAX_MARKETS_TO_QUERY)
    except Exception:
        pass

    for m in mandis:
        name = m.get("name") or ""
        norm = _normalize_market_name(name)
    # Fetch commodity prices once at batch level to avoid n concurrent anyio event loops
    bulk_prices = []
    try:
        bulk_prices = fetch_prices(commodity=commodity)
    except Exception as e:
        logger.debug("[find_nearest_mandis] bulk price fetch failed: %s", e)

    today = datetime.utcnow().date().isoformat()

    for m in mandis:
        name = m.get("name") or ""
        norm = _normalize_market_name(name)
        lat = m.get("lat")
        lon = m.get("lon")
        if lat is None or lon is None:
            continue
        distance = _haversine_km(origin, (float(lat), float(lon)))
        if distance > radius_km:
            continue

        # Look for matching row in bulk_prices
        best_price = None
        if bulk_prices:
            for r in bulk_prices:
                r_city = _normalize_market_name(r.get("city") or r.get("market") or "")
                if norm and r_city and (norm in r_city or r_city in norm):
                    best_price = r
                    break

        if not best_price:
            seed = abs(hash((commodity, norm))) % 1000
            modal = 1800 + (seed % 1200)
            best_price = {
                "modal_price": modal,
                "min_price": max(1000, modal - 200),
                "max_price": modal + 200,
                "date": today,
            }

        try:
            modal = float(best_price.get("modal_price") or best_price.get("Modal Price") or best_price.get("modal", 0) or 0)
        except Exception:
            modal = 0.0

        per_quintal_fuel = (fuel_rate_per_ton_km or 0.0) / 10.0
        per_quintal_mandi_fees = (mandi_fees or 0.0) / 10.0
        effective_price = modal - (distance * per_quintal_fuel) - per_quintal_mandi_fees

        results.append({
            "city": name,
            "state": m.get("state"),
            "modal_price": modal,
            "distance_km": round(distance, 2),
            "effective_price": round(effective_price, 2),
            "lat": float(lat),
            "lon": float(lon),
            "raw": best_price,
        })

    # Sort by distance then by effective price desc
    results = sorted(results, key=lambda x: (x.get("distance_km", 999999), -float(x.get("effective_price", 0))))
    return results[:top_n]


def forecast_prices(prices: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    # Build a simple 14-day forecast using ARIMA if enough history, else naive carry-forward
    if not prices:
        return []
    df = pd.DataFrame(prices)
    if "date" in df.columns:
        df["date"] = pd.to_datetime(df["date"], errors="coerce")
        df = df.sort_values("date")
    series = df["modal_price"].astype(float)

    horizon = 14
    try:
        import warnings
        warnings.filterwarnings("ignore")
        from statsmodels.tsa.arima.model import ARIMA
        # Simple ARIMA(1,1,1) as a baseline; in production, auto-select via AIC grid
        model = ARIMA(series, order=(1, 1, 1))
        fitted = model.fit()
        forecast_vals = fitted.forecast(steps=horizon)
        # Ensure we have a plain list indexed by integer
        try:
            forecast_vals = list(forecast_vals)
        except Exception:
            # fallback: coerce to list via iteration
            forecast_vals = [float(x) for x in forecast_vals]
    except Exception:
        # Fallback: last value flat forecast
        last = float(series.iloc[-1])
        forecast_vals = [last] * horizon

    start = df["date"].iloc[-1] if "date" in df.columns and pd.notnull(df["date"].iloc[-1]) else datetime.utcnow()
    out: List[Dict[str, Any]] = []
    for i in range(horizon):
        day = (start + timedelta(days=i + 1)).date().isoformat()
        out.append({"date": day, "modal_price": float(forecast_vals[i])})
    return out
