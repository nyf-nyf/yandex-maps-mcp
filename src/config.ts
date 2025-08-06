import { Tool } from "@modelcontextprotocol/sdk/types.js";

function getApiKey(): string {
  const apiKey = process.env.YANDEX_MAPS_API_KEY;
  if (!apiKey) {
    console.error("YANDEX_MAPS_API_KEY environment variable is not set");
    process.exit(1);
  }
  return apiKey;
}

function getStaticApiKey(): string {
  const apiKey = process.env.YANDEX_MAPS_STATIC_API_KEY;
  if (!apiKey) {
    console.error("YANDEX_MAPS_STATIC_API_KEY environment variable is not set");
    process.exit(1);
  }
  return apiKey;
}

export const YANDEX_MAPS_API_KEY = getApiKey();
export const YANDEX_MAPS_STATIC_API_KEY = getStaticApiKey();

export const YANDEX_MAPS_GEOCODER_BASE_URL = "https://geocode-maps.yandex.ru/1.x/";
export const YANDEX_MAPS_STATIC_BASE_URL = "https://static-maps.yandex.ru/v1";

export const GEOCODE_TOOL: Tool = {
  name: "maps_geocode",
  description: "Convert an address into geographic coordinates using individual address components",
  inputSchema: {
    type: "object",
    properties: {
      country: {
        type: "string",
        description: "The country name"
      },
      state: {
        type: "string",
        description: "The state, region or province name"
      },
      city: {
        type: "string",
        description: "The city or locality name"
      },
      district: {
        type: "string",
        description: "The district or neighborhood within the city"
      },
      street: {
        type: "string",
        description: "The street name"
      },
      house_number: {
        type: "string",
        description: "The house or building number"
      },
      lang: {
        type: "string",
        description: "Language code, e.g. 'ru_RU', 'en_US'"
      }
    },
    required: ["country", "lang"]
  }
};

export const REVERSE_GEOCODE_TOOL: Tool = {
  name: "maps_reverse_geocode",
  description: "Convert coordinates into an address",
  inputSchema: {
    type: "object",
    properties: {
      latitude: {
        type: "number",
        description: "Latitude coordinate"
      },
      longitude: {
        type: "number",
        description: "Longitude coordinate"
      },
      lang: {
        type: "string",
        description: "Language code, e.g. 'ru_RU', 'en_US'"
      }
    },
    required: ["latitude", "longitude", "lang"]
  }
};

export const RENDER_MAP_TOOL: Tool = {
  name: "maps_render",
  description: "Render a map as a png image",
  inputSchema: {
    type: "object",
    properties: {
      latitude: {
        type: "number",
        description: "Latitude coordinate of map center"
      },
      longitude: {
        type: "number",
        description: "Longitude coordinate of map center"
      },
      latitude_span: {
        type: "number",
        description: "Height of map image in degrees"
      },
      longitude_span: {
        type: "number",
        description: "Width of map image in degrees"
      },
      lang: {
        type: "string",
        description: "Language code, e.g. 'ru_RU', 'en_US'"
      },
      placemarks: {
        type: "array",
        description: "Array of placemarks to display on the map",
        items: {
          type: "object",
          properties: {
            latitude: {
              type: "number",
              description: "Latitude coordinate of the placemark"
            },
            longitude: {
              type: "number",
              description: "Longitude coordinate of the placemark"
            }
          },
          required: ["latitude", "longitude"]
        }
      }
    },
    required: ["latitude", "longitude", "latitude_span", "longitude_span", "lang"]
  }
};

export const MAPS_TOOLS = [
  GEOCODE_TOOL,
  REVERSE_GEOCODE_TOOL,
  RENDER_MAP_TOOL,
] as const;