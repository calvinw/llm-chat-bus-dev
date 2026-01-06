#!/usr/bin/env python3
"""
MCP Server with Math Tools
Supports both SSE and HTTP transports, defaulting to SSE.

Usage:
    python mcp_server.py                    # SSE on port 8000
    python mcp_server.py --transport http   # HTTP on port 8000  
    python mcp_server.py --port 8001        # SSE on port 8001
    python mcp_server.py --transport http --port 8001  # HTTP on port 8001
"""

import os
import sys
import argparse
from fastmcp import FastMCP
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import uvicorn


def create_mcp_server(transport_type: str = "sse") -> tuple[FastMCP, str]:
    """Create MCP server with specified transport type."""
    
    # Server configuration based on transport
    if transport_type.lower() == "sse":
        server_name = "MathToolsSSE"
        path = "/sse"
        transport = "sse"
        stateless = False
    elif transport_type.lower() in ["http", "streamable-http"]:
        server_name = "MathToolsHTTP"
        path = "/mcp"
        transport = "streamable-http"
        stateless = True
    else:
        raise ValueError(f"Unsupported transport type: {transport_type}")
    
    # Create MCP server
    mcp = FastMCP(server_name, stateless_http=stateless)
    
    # Define math tools
    @mcp.tool()
    def multiply_numbers(a: float = 2.0, b: float = 3.5) -> dict:
        """Multiply two numbers together"""
        return {
            "operation": "multiplication",
            "a": a,
            "b": b,
            "result": a * b
        }
    
    @mcp.tool()
    def divide_numbers(a: float = 10.0, b: float = 2.0) -> dict:
        """Divide first number by second number"""
        if b == 0:
            return {
                "operation": "division",
                "a": a,
                "b": b,
                "error": "Division by zero is not allowed",
                "result": None
            }
        return {
            "operation": "division",
            "a": a,
            "b": b,
            "result": a / b
        }
    
    return mcp, path


async def oauth_metadata(request: Request) -> JSONResponse:
    """Minimal OAuth endpoint for Claude.ai compatibility."""
    base_url = str(request.base_url).rstrip("/")
    return JSONResponse({
        "issuer": base_url
    })


def create_app(transport_type: str = "sse") -> FastAPI:
    """Create and configure the FastAPI application."""
    
    # Create MCP server
    mcp, endpoint_path = create_mcp_server(transport_type)
    
    # Create the ASGI app
    http_app = mcp.http_app(
        transport="sse" if transport_type.lower() == "sse" else "streamable-http",
        path=endpoint_path
    )
    
    # Create FastAPI app
    app = FastAPI(
        title=f"Math Tools MCP Server ({transport_type.upper()})",
        description="MCP server with mathematical operations",
        version="1.0.0",
        lifespan=http_app.lifespan
    )
    
    # Add CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],  # Access-Control-Allow-Origin
        allow_methods=["GET", "POST", "OPTIONS"],  # Access-Control-Allow-Methods
        allow_headers=["Content-Type", "Authorization", "x-api-key"],  # Access-Control-Allow-Headers
        expose_headers=["Content-Type", "Authorization", "x-api-key"],  # Access-Control-Expose-Headers
        max_age=86400  # Access-Control-Max-Age (in seconds)
    )
    
    # Add OAuth metadata route
    app.add_api_route(
        "/.well-known/oauth-authorization-server", 
        oauth_metadata, 
        methods=["GET"],
        description="OAuth metadata endpoint for Claude.ai"
    )
    
    # Add info endpoint
    @app.get("/info")
    async def server_info():
        """Get server information."""
        return {
            "server": "Math Tools MCP Server",
            "transport": transport_type.upper(),
            "endpoint": endpoint_path,
            "tools": ["multiply_numbers", "divide_numbers"],
            "version": "1.0.0"
        }
    
    # Mount the MCP server
    app.mount("/", http_app)
    
    return app, endpoint_path


def parse_args():
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(
        description="MCP Server with Math Tools",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python mcp_server.py                          # SSE on port 8000
  python mcp_server.py --transport http         # HTTP on port 8000
  python mcp_server.py --port 8001              # SSE on port 8001
  python mcp_server.py --transport http --port 8001  # HTTP on port 8001
        """
    )
    
    parser.add_argument(
        "--transport", "-t",
        choices=["sse", "http", "streamable-http"],
        default="sse",
        help="Transport type (default: sse)"
    )
    
    parser.add_argument(
        "--port", "-p",
        type=int,
        default=int(os.environ.get("PORT", 8000)),
        help="Port to run server on (default: 8000, or PORT env var)"
    )
    
    parser.add_argument(
        "--host",
        default="0.0.0.0",
        help="Host to bind to (default: 0.0.0.0)"
    )
    
    parser.add_argument(
        "--reload",
        action="store_true",
        help="Enable auto-reload for development"
    )
    
    return parser.parse_args()


def main():
    """Main entry point."""
    args = parse_args()
    
    # Normalize transport type
    transport = args.transport.lower()
    if transport in ["http", "streamable-http"]:
        transport = "http"
    
    # Create the app
    app, endpoint_path = create_app(transport)
    
    # Print startup information
    transport_display = transport.upper()
    print(f"\n🚀 Math Tools MCP Server")
    print(f"📡 Transport: {transport_display}")
    print(f"🌐 Server: http://{args.host}:{args.port}")
    print(f"🔧 Endpoint: http://{args.host}:{args.port}{endpoint_path}")
    print(f"ℹ️  Info: http://{args.host}:{args.port}/info")
    print(f"🔑 OAuth: http://{args.host}:{args.port}/.well-known/oauth-authorization-server")
    print(f"🛠️  Tools: multiply_numbers, divide_numbers")
    
    if args.reload:
        print(f"🔄 Auto-reload: enabled")
    
    print(f"\n⚡ Starting server on {args.host}:{args.port}...")
    
    # Start the server
    if args.reload:
        # For reload mode, we need to set environment variables and use import string
        os.environ['TRANSPORT_TYPE'] = transport
        uvicorn.run(
            "mcp_server:get_app",
            host=args.host,
            port=args.port,
            reload=True
        )
    else:
        # For production mode, create app directly
        app, _ = create_app(transport)
        uvicorn.run(
            app,
            host=args.host,
            port=args.port,
            reload=False
        )


def get_app():
    """Factory function for uvicorn reload mode."""
    transport = os.environ.get('TRANSPORT_TYPE', 'sse')
    app, _ = create_app(transport)
    return app


if __name__ == "__main__":
    main()