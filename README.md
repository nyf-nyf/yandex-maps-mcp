# Yandex Maps MCP Server

MCP Server for the Yandex Maps API.

## Tools

1. `maps_geocode`
   - Convert address to coordinates
   - Inputs:
     - `address` (string) - The address to geocode
     - `lang` (string, optional) - Language code (e.g., 'ru_RU', 'en_US')
   - Returns: location, formatted_address, address_components

2. `maps_reverse_geocode`
   - Convert coordinates to address
   - Inputs:
     - `latitude` (number)
     - `longitude` (number)
     - `lang` (string, optional) - Language code (e.g., 'ru_RU', 'en_US')
   - Returns: location, formatted_address, address_components

3. `maps_render`
   - Render a map as a png image
   - Inputs:
     - `latitude` (number) - Latitude coordinate of map center
     - `longitude` (number) - Longitude coordinate of map center
     - `latitude_span` (number) - Height of map image in degrees
     - `longitude_span` (number) - Width of map image in degrees
     - `lang` (string, optional) - Language code (e.g., 'ru_RU', 'en_US')
     - `placemarks` (array, optional) - Array of placemarks to display on the map with style "pm2rdm"
       - Each placemark should have `latitude` and `longitude` properties
   - Returns: PNG image of the map

## Setup

### API Keys
You'll need two Yandex Maps API keys:

1. JavaScript and Geocoder API key for geocoding functions
2. Static API key for map rendering

To generate API keys:
1. Open https://developer.tech.yandex.ru/ and authorize
2. Click 'Connect APIs'. Choose 'JavaScript and Geocoder API' and fill the form
3. Navigate to API's dashboard page and copy API key there
4. Repeat from step 2 for Static API.

Set these as environment variables:
- `YANDEX_MAPS_API_KEY` - For geocoding operations
- `YANDEX_MAPS_STATIC_API_KEY` - For static map rendering

### Local Run

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set your API keys:
   ```bash
   export YANDEX_MAPS_API_KEY="your-geocoder-api-key"
   export YANDEX_MAPS_STATIC_API_KEY="your-static-api-key"
   ```
4. Build server
   ```bash
   npm run build
   ```
4. Run the server:
   ```bash
   node dist/index.js
   # Or if using TypeScript directly:
   ts-node dist/index.js
   index.ts
   ```

### Usage with Claude Desktop

Add the following to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "yandex-maps": {
      "command": "node",
      "args": [
        "path/to/index.js"
      ],
      "env": {
        "YANDEX_MAPS_API_KEY": "<YOUR_GEOCODER_API_KEY>",
        "YANDEX_MAPS_STATIC_API_KEY": "<YOUR_STATIC_API_KEY>"
      }
    }
  }
}
```
