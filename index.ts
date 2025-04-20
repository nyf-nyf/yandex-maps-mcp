#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import fetch from "node-fetch";

// Response interfaces
interface YandexMapsResponse {
  status: string;
  error_message?: string;
}

interface GeocodeResponse extends YandexMapsResponse {
  response: {
    GeoObjectCollection: {
      metaDataProperty: {
        GeocoderResponseMetaData: {
          request: string;
          results: string;
          found: string;
        };
      };
      featureMember: Array<{
        GeoObject: {
          metaDataProperty: {
            GeocoderMetaData: {
              precision: string;
              text: string;
              kind: string;
              Address: {
                country_code: string;
                formatted: string;
                Components: Array<{
                  kind: string;
                  name: string;
                }>;
              };
              AddressDetails: {
                Country: {
                  AddressLine: string;
                  CountryNameCode: string;
                  CountryName: string;
                  AdministrativeArea?: {
                    AdministrativeAreaName: string;
                    Locality?: {
                      LocalityName: string;
                      Thoroughfare?: {
                        ThoroughfareName: string;
                        Premise?: {
                          PremiseNumber: string;
                        };
                      };
                    };
                  };
                };
              };
            };
          };
          description: string;
          name: string;
          boundedBy: {
            Envelope: {
              lowerCorner: string;
              upperCorner: string;
            };
          };
          Point: {
            pos: string;
          };
        };
      }>;
    };
  };
}

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

const YANDEX_MAPS_API_KEY = getApiKey();
const YANDEX_MAPS_STATIC_API_KEY = getStaticApiKey();

// Tool definitions
const GEOCODE_TOOL: Tool = {
    name: "maps_geocode",
    description: "Convert an address into geographic coordinates",
    inputSchema: {
      type: "object",
      properties: {
        address: {
          type: "string",
          description: "The address to geocode"
        },
        lang: {
          type: "string",
          description: "Language code (e.g., 'ru_RU', 'en_US')"
        }
      },
      required: ["address", "lang"]
    }
  };

const REVERSE_GEOCODE_TOOL: Tool = {
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
        description: "Language code (e.g., 'ru_RU', 'en_US')"
      }
    },
    required: ["latitude", "longitude", "lang"]
  }
};

const RENDER_MAP_TOOL: Tool = {
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
        description: "Language code (e.g., 'ru_RU', 'en_US')"
      }
    },
    required: ["latitude", "longitude", "latitude_span", "longitude_span", "lang"]
  }
}

const MAPS_TOOLS = [
  GEOCODE_TOOL,
  REVERSE_GEOCODE_TOOL,
  RENDER_MAP_TOOL,
] as const;

const YANDEX_MAPS_GEOCODER_BASE_URL = "https://geocode-maps.yandex.ru/1.x/";
const YANDEX_MAPS_STATIC_BASE_URL = "https://static-maps.yandex.ru/v1";

// API handlers
async function handleGeocode(address: string, lang: string) {
  const url = new URL(YANDEX_MAPS_GEOCODER_BASE_URL);
  url.searchParams.append("geocode", address);
  url.searchParams.append("format", "json");
  url.searchParams.append("results", "1");
  url.searchParams.append("lang", lang);
  url.searchParams.append("apikey", YANDEX_MAPS_API_KEY);

  const response = await fetch(url.toString());
  const data = await response.json() as GeocodeResponse;

  // Check for API errors
  if ('error' in data) {
    return {
      content: [{
        type: "text",
        text: `Geocoding failed: ${(data as any).message || 'Unknown error'}`
      }],
      isError: true
    };
  }

  if (!data.response || data.response.GeoObjectCollection.featureMember.length === 0) {
    return {
      content: [{
        type: "text",
        text: `Geocoding failed: No results found`
      }],
      isError: true
    };
  }

  const geoObject = data.response.GeoObjectCollection.featureMember[0].GeoObject;
  const point = geoObject.Point?.pos.split(' ').map(Number); // Format: "longitude latitude"
  
  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        location: point ? { lng: point[0], lat: point[1] } : null,
        formatted_address: geoObject.metaDataProperty.GeocoderMetaData.text,
        address_components: geoObject.metaDataProperty.GeocoderMetaData.Address.Components
      }, null, 2)
    }],
    isError: false
  };
}

async function handleReverseGeocode(latitude: number, longitude: number, lang: string) {
  const url = new URL(YANDEX_MAPS_GEOCODER_BASE_URL);
  url.searchParams.append("geocode", `${longitude},${latitude}`);
  url.searchParams.append("format", "json");
  url.searchParams.append("results", "1");
  url.searchParams.append("lang", lang);
  url.searchParams.append("apikey", YANDEX_MAPS_API_KEY);

  console.error(url.toString());

  const response = await fetch(url.toString());
  const data = await response.json() as GeocodeResponse;

  // Check for API errors
  if ('error' in data) {
    return {
      content: [{
        type: "text",
        text: `Reverse geocoding failed: ${(data as any).message || 'Unknown error'}`
      }],
      isError: true
    };
  }

  if (!data.response || data.response.GeoObjectCollection.featureMember.length === 0) {
    return {
      content: [{
        type: "text",
        text: `Reverse geocoding failed: No results found`
      }],
      isError: true
    };
  }

  const geoObject = data.response.GeoObjectCollection.featureMember[0].GeoObject;
  const point = geoObject.Point?.pos.split(' ').map(Number); // Format: "longitude latitude"
  
  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        location: point ? { lng: point[0], lat: point[1] } : null,
        formatted_address: geoObject.metaDataProperty.GeocoderMetaData.text,
        address_components: geoObject.metaDataProperty.GeocoderMetaData.Address.Components
      }, null, 2)
    }],
    isError: false
  };
}

async function handleRenderMap(
  latitude: number,
  longitude: number,
  latitude_span: number,
  longitude_span: number,
  lang: string
) {
  // Calculate bounds based on center and span
  const ll = `${longitude},${latitude}`; // Center point (lon,lat)
  const spn = `${longitude_span},${latitude_span}`; // Span (lon_span,lat_span)

  const url = new URL(YANDEX_MAPS_STATIC_BASE_URL);
  url.searchParams.append("ll", ll);
  url.searchParams.append("spn", spn);
  url.searchParams.append("l", "map"); // Default layer type
  url.searchParams.append("lang", lang);
  url.searchParams.append("apikey", YANDEX_MAPS_STATIC_API_KEY);

  try {
    // Fetch the actual image data
    const response = await fetch(url.toString());
    
    if (!response.ok) {
      const errorText = await response.text();
      return {
        content: [{
          type: "text",
          text: `Failed to fetch map image: ${response.status} ${response.statusText}\n${errorText}`
        }],
        isError: true
      };
    }
    
    // Get the image as buffer
    const arrayBuffer = await response.arrayBuffer();
    const imageBuffer = Buffer.from(arrayBuffer);
    
    // Convert to base64 for transmission
    const base64Data = imageBuffer.toString('base64');
    const contentType = response.headers.get('content-type') || 'image/png';
    
    // Return as proper MCP image content
    return {
      content: [{
        type: "image",
        data: base64Data,
        mimeType: contentType
      }],
      isError: false
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `Error rendering map: ${error instanceof Error ? error.message : String(error)}`
      }],
      isError: true
    };
  }
}

// Server setup
const server = new Server(
  {
    name: "mcp-server/yandex-maps",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

// Set up request handlers
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: MAPS_TOOLS,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    switch (request.params.name) {
      case "maps_geocode": {
        const { address, lang } = request.params.arguments as { 
          address: string;
          lang: string;
        };
        return await handleGeocode(address, lang);
      }

      case "maps_reverse_geocode": {
        const { latitude, longitude, lang } = request.params.arguments as {
          latitude: number;
          longitude: number;
          lang: string;
        };
        return await handleReverseGeocode(latitude, longitude, lang);
      }

      case "maps_render": {
        const { latitude, longitude, latitude_span, longitude_span, lang } = request.params.arguments as {
          latitude: number;
          longitude: number;
          latitude_span: number;
          longitude_span: number;
          lang: string;
        };
        return await handleRenderMap(latitude, longitude, latitude_span, longitude_span, lang);
      }

      default:
        return {
          content: [{
            type: "text",
            text: `Unknown tool: ${request.params.name}`
          }],
          isError: true
        };
    }
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `Error: ${error instanceof Error ? error.message : String(error)}`
      }],
      isError: true
    };
  }
});

async function runServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Yandex Maps MCP Server running on stdio");
}

runServer().catch((error) => {
  console.error("Fatal error running server:", error);
  process.exit(1);
});