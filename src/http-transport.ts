import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { URL } from "node:url";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { createMCPServer } from "./server.js";
import { MAPS_TOOLS } from "./config.js";
import { handleGeocode, handleReverseGeocode, handleRenderMap } from "./handlers.js";

interface SessionData {
  transport: SSEServerTransport;
  server: Server;
}

export class HttpTransport {
  private transports = new Map<string, SSEServerTransport>();
  private servers = new Map<string, Server>();
  private sessionOrder: string[] = [];

  async runHttpServer(): Promise<void> {
    const httpServer = createServer(async (req, res) => {
      await this.handleRequest(req, res);
    });

    const PORT = process.env.PORT || 3000;
    const HOST = process.env.HOST || '0.0.0.0';
    
    httpServer.listen(Number(PORT), HOST, () => {
      console.error(`Yandex Maps MCP Server running on http://${HOST}:${PORT}`);
      console.error(`Streamable HTTP endpoint: http://${HOST}:${PORT}/mcp`);
      console.error(`Legacy SSE endpoint: http://${HOST}:${PORT}/sse`);
      console.error(`Legacy message endpoint: http://${HOST}:${PORT}/message`);
    });

    process.on('SIGINT', () => {
      console.error('\nShutting down...');
      httpServer.close();
      process.exit(0);
    });
  }

  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    
    console.error(`${new Date().toISOString()} - ${req.method} ${url.pathname}`);
    
    this.setCorsHeaders(res);
    
    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    // Route handlers
    if (url.pathname === '/mcp') {
      await this.handleMcpEndpoint(req, res, url);
    } else if (url.pathname === '/sse') {
      await this.handleLegacySseEndpoint(req, res);
    } else if (url.pathname === '/message') {
      await this.handleLegacyMessageEndpoint(req, res);
    } else if (url.pathname === '/tools') {
      await this.handleToolsDiscovery(req, res);
    } else if (url.pathname === '/health') {
      await this.handleHealthCheck(req, res);
    } else {
      this.handle404(res);
    }
  }

  private setCorsHeaders(res: ServerResponse): void {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Session-Id, Accept, Last-Event-ID, Mcp-Session-Id');
  }

  private async handleMcpEndpoint(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
    if (req.method === 'GET') {
      await this.handleMcpGet(req, res);
    } else if (req.method === 'POST') {
      await this.handleMcpPost(req, res);
    } else if (req.method === 'DELETE') {
      await this.handleMcpDelete(req, res);
    } else {
      this.handleMethodNotAllowed(res);
    }
  }

  private async handleMcpGet(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const accept = req.headers.accept || '';
    
    if (accept.includes('text/event-stream')) {
      try {
        const transport = new SSEServerTransport('/mcp', res);
        const server = createMCPServer();
        
        this.storeSession(transport, server);
        console.error(`SSE connection established, session ID: ${transport.sessionId}`);
        
        await server.connect(transport);
        
        transport.onclose = () => {
          this.cleanupSession(transport.sessionId);
          console.error(`SSE connection closed, session ID: ${transport.sessionId}`);
        };
      } catch (error) {
        console.error('Error establishing SSE connection:', error);
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Internal Server Error');
      }
    } else {
      res.writeHead(405, { 'Content-Type': 'text/plain' });
      res.end('Method Not Allowed');
    }
  }

  private async handleMcpPost(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const body = await this.readRequestBody(req);
      const sessionId = req.headers['mcp-session-id'] as string || req.headers['x-session-id'] as string;
      const transport = this.findTransport(sessionId);
      
      if (transport) {
        await transport.handlePostMessage(req, res);
      } else {
        await this.handleStreamableHttpPost(body, res);
      }
    } catch (error) {
      console.error('Error handling POST request:', error);
      this.sendJsonError(res, -32603, 'Internal error', error instanceof Error ? error.message : String(error));
    }
  }

  private async handleStreamableHttpPost(body: string, res: ServerResponse): Promise<void> {
    const jsonMessage = JSON.parse(body);
    console.error('Handling Streamable HTTP request:', jsonMessage.method);
    
    switch (jsonMessage.method) {
      case 'initialize':
        this.sendJsonResponse(res, jsonMessage.id, {
          protocolVersion: '2024-11-05',
          serverInfo: {
            name: 'mcp-server/yandex-maps',
            version: '0.1.0'
          },
          capabilities: {
            tools: {}
          }
        });
        break;

      case 'tools/list':
        this.sendJsonResponse(res, jsonMessage.id, { tools: MAPS_TOOLS });
        break;

      case 'tools/call':
        await this.handleToolCall(jsonMessage, res);
        break;

      default:
        this.sendJsonError(res, -32601, 'Method not found', { method: jsonMessage.method }, jsonMessage.id);
    }
  }

  private async handleToolCall(jsonMessage: any, res: ServerResponse): Promise<void> {
    try {
      const toolName = jsonMessage.params.name;
      const toolArgs = jsonMessage.params.arguments;
      
      let result;
      switch (toolName) {
        case 'maps_geocode':
          result = await handleGeocode(
            toolArgs.country, 
            toolArgs.lang, 
            toolArgs.state, 
            toolArgs.city, 
            toolArgs.district, 
            toolArgs.street, 
            toolArgs.house_number
          );
          break;
        case 'maps_reverse_geocode':
          result = await handleReverseGeocode(toolArgs.latitude, toolArgs.longitude, toolArgs.lang);
          break;
        case 'maps_render':
          result = await handleRenderMap(
            toolArgs.latitude, 
            toolArgs.longitude, 
            toolArgs.latitude_span, 
            toolArgs.longitude_span, 
            toolArgs.lang, 
            toolArgs.placemarks
          );
          break;
        default:
          result = {
            content: [{ type: "text", text: `Unknown tool: ${toolName}` }],
            isError: true
          };
      }
      
      this.sendJsonResponse(res, jsonMessage.id, {
        content: result.content,
        isError: result.isError
      });
    } catch (error) {
      this.sendJsonResponse(res, jsonMessage.id, {
        content: [{ type: "text", text: `Tool error: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true
      });
    }
  }

  private async handleMcpDelete(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const sessionId = req.headers['mcp-session-id'] as string;
    
    if (sessionId && this.transports.has(sessionId)) {
      const transport = this.transports.get(sessionId);
      transport?.onclose?.();
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('Session terminated');
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Session not found');
    }
  }

  private async handleLegacySseEndpoint(req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (req.method !== 'GET') {
      this.handleMethodNotAllowed(res);
      return;
    }

    console.error("Legacy SSE endpoint accessed");
    
    try {
      const transport = new SSEServerTransport('/message', res);
      const server = createMCPServer();
      
      this.storeSession(transport, server);
      console.error(`Legacy SSE connection established, session ID: ${transport.sessionId}`);
      
      await server.connect(transport);
      
      transport.onclose = () => {
        this.cleanupSession(transport.sessionId);
        console.error(`Legacy SSE connection closed, session ID: ${transport.sessionId}`);
      };
    } catch (error) {
      console.error('Error establishing legacy SSE connection:', error);
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Internal Server Error');
    }
  }

  private async handleLegacyMessageEndpoint(req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (req.method !== 'POST') {
      this.handleMethodNotAllowed(res);
      return;
    }

    console.error('Legacy message endpoint accessed');
    
    const sessionId = req.headers['x-session-id'] as string;
    const transport = this.findTransport(sessionId);
    
    if (!transport) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('No active session found');
      return;
    }
    
    try {
      await transport.handlePostMessage(req, res);
    } catch (error) {
      console.error('Error handling legacy POST message:', error);
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Internal Server Error');
    }
  }

  private async handleToolsDiscovery(req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (req.method !== 'GET') {
      this.handleMethodNotAllowed(res);
      return;
    }

    try {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ tools: MAPS_TOOLS }));
    } catch (error) {
      console.error('Error handling tools request:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal Server Error' }));
    }
  }

  private async handleHealthCheck(req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (req.method !== 'GET') {
      this.handleMethodNotAllowed(res);
      return;
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }));
  }

  private handle404(res: ServerResponse): void {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  }

  private handleMethodNotAllowed(res: ServerResponse): void {
    res.writeHead(405, { 'Content-Type': 'text/plain' });
    res.end('Method Not Allowed');
  }

  // Helper methods
  private storeSession(transport: SSEServerTransport, server: Server): void {
    this.transports.set(transport.sessionId, transport);
    this.servers.set(transport.sessionId, server);
    this.sessionOrder.push(transport.sessionId);
  }

  private cleanupSession(sessionId: string): void {
    this.transports.delete(sessionId);
    this.servers.delete(sessionId);
    const index = this.sessionOrder.indexOf(sessionId);
    if (index > -1) {
      this.sessionOrder.splice(index, 1);
    }
  }

  private findTransport(sessionId?: string): SSEServerTransport | undefined {
    if (sessionId) {
      return this.transports.get(sessionId);
    } else if (this.sessionOrder.length === 1) {
      return this.transports.get(this.sessionOrder[0]);
    }
    return undefined;
  }

  private async readRequestBody(req: IncomingMessage): Promise<string> {
    return new Promise((resolve) => {
      let body = '';
      req.on('data', chunk => {
        body += chunk.toString();
      });
      req.on('end', () => {
        resolve(body);
      });
    });
  }

  private sendJsonResponse(res: ServerResponse, id: any, result: any): void {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      jsonrpc: '2.0',
      id,
      result
    }));
  }

  private sendJsonError(res: ServerResponse, code: number, message: string, data?: any, id?: any): void {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      jsonrpc: '2.0',
      id: id || null,
      error: { code, message, data }
    }));
  }
}