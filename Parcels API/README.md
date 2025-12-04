# Parcels API Module

A production-ready parcels API module with PostGIS spatial queries and GeoJSON support.

## Features

- Spatial queries using PostGIS ST_Intersects
- Bounding box filtering
- GeoJSON FeatureCollection and Feature responses
- Safe field filtering (excludes private data)
- Efficient spatial indexing

## Prerequisites

- PostgreSQL with PostGIS extension installed
- PostGIS extension enabled in database

## Setup

1. Install dependencies:
```bash
npm install
```

2. Ensure PostGIS is installed:
```bash
# On Ubuntu/Debian
sudo apt-get install postgis

# On macOS
brew install postgis
```

3. Run migration to create parcels table:
```bash
psql -d auth_db -f src/migrations/001_create_parcels_table.sql
```

4. Start the server:
```bash
npm start
```

## API Endpoints

### GET /parcels?bbox=minLon,minLat,maxLon,maxLat

Get parcels within a bounding box.

**Query Parameters:**
- `bbox` (required) - Bounding box as comma-separated values: `minLon,minLat,maxLon,maxLat`

**Example:**
```
GET /parcels?bbox=-122.5,37.7,-122.3,37.8
```

**Response:**
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "id": "parcel_123",
      "geometry": {
        "type": "Polygon",
        "coordinates": [[[-122.4194, 37.7749], ...]]
      },
      "properties": {
        "price_cents": 100000,
        "available_for_rent": true,
        "metadata": {}
      }
    }
  ]
}
```

### GET /parcels/:id

Get a single parcel by ID.

**Example:**
```
GET /parcels/parcel_123
```

**Response:**
```json
{
  "type": "Feature",
  "id": "parcel_123",
  "geometry": {
    "type": "Polygon",
    "coordinates": [[[-122.4194, 37.7749], ...]]
  },
  "properties": {
    "price_cents": 100000,
    "available_for_rent": true,
    "metadata": {}
  }
}
```

## Database Schema

### parcels table

- `parcel_id` TEXT PRIMARY KEY
- `geom` GEOMETRY(POLYGON,4326) NOT NULL - PostGIS geometry in WGS84
- `owner_id` UUID NULL - References users.id (private, not returned in API)
- `price_cents` BIGINT NULL - Price in cents
- `available_for_rent` BOOLEAN NOT NULL DEFAULT false
- `metadata` JSONB DEFAULT '{}'::jsonb - Additional metadata

**Indexes:**
- Spatial GIST index on `geom` for efficient spatial queries
- Index on `owner_id`
- Index on `available_for_rent`

## GeoJSON Format

The API returns standard GeoJSON format:
- **FeatureCollection** for bbox queries (multiple parcels)
- **Feature** for single parcel queries

All geometries are in WGS84 (SRID 4326) and converted to GeoJSON using PostGIS `ST_AsGeoJSON`.

## Error Responses

- `400` - Invalid bbox format or coordinates
- `404` - Parcel not found
- `500` - Internal server error

## Testing

Run tests:
```bash
npm test
```

Tests include:
- Bbox query validation
- GeoJSON format validation
- PostGIS spatial queries
- Error handling

## Environment Variables

- `DB_HOST` - PostgreSQL host (default: localhost)
- `DB_PORT` - PostgreSQL port (default: 5432)
- `DB_NAME` - Database name (default: auth_db)
- `DB_USER` - Database user (default: postgres)
- `DB_PASSWORD` - Database password (default: postgres)
- `PARCELS_PORT` - Server port (default: 3002)
- `NODE_ENV` - Environment (development/production)

## Security

- Only public fields are returned (owner_id is excluded)
- Input validation for all bbox parameters
- SQL injection prevention via parameterized queries
- Coordinate range validation

