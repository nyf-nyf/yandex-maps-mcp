#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createMCPServer } from "./src/server.js";
import { HttpTransport } from "./src/http-transport.js";

async function runStdioServer() {
  const server = createMCPServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Yandex Maps MCP Server running on stdio");
}

async function main() {
  const args = process.argv.slice(2);
  const transportType = args.includes('--transport') ? args[args.indexOf('--transport') + 1] : 'stdio';

  try {
    switch (transportType) {
      case 'http':
      case 'sse':
        const httpTransport = new HttpTransport();
        await httpTransport.runHttpServer();
        break;
      case 'stdio':
      default:
        await runStdioServer();
        break;
    }
  } catch (error) {
    console.error('Fatal error running server:', error);
    process.exit(1);
  }
}

main();