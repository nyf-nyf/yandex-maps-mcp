import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  CallToolResult,
} from "@modelcontextprotocol/sdk/types.js";
import { MAPS_TOOLS } from "./config.js";
import { handleGeocode, handleReverseGeocode, handleRenderMap } from "./handlers.js";

export function createMCPServer(): Server {
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

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: MAPS_TOOLS,
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request): Promise<CallToolResult> => {
    try {
      switch (request.params.name) {
        case "maps_geocode": {
          const { country, lang, state, city, district, street, house_number } = request.params.arguments as { 
            country: string;
            lang: string;
            state?: string;
            city?: string;
            district?: string;
            street?: string;
            house_number?: string;
          };
          return await handleGeocode(country, lang, state, city, district, street, house_number);
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
          const { latitude, longitude, latitude_span, longitude_span, lang, placemarks } = request.params.arguments as {
            latitude: number;
            longitude: number;
            latitude_span: number;
            longitude_span: number;
            lang: string;
            placemarks?: Array<{ latitude: number, longitude: number }>;
          };
          return await handleRenderMap(latitude, longitude, latitude_span, longitude_span, lang, placemarks);
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

  return server;
}