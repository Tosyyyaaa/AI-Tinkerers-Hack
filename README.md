# Weather MCP Agent 🌤️🎵

A minimal Agno agent with MCP (Model Context Protocol) weather tool for environment-aware music recommendations.

## Features

- **MCP Weather Server**: Stateless weather tool that returns music-friendly weather buckets
- **Agno Agent Integration**: Uses MCPTools to connect with the weather server
- **FastAPI Endpoint**: Simple REST API for weather bucket queries
- **Environment-Aware**: Maps weather conditions to music categories (sunny/cloudy/rainy/windy/night)

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   FastAPI App   │───▶│   Agno Agent     │───▶│  MCP Server     │
│                 │    │ (DeepSeek v3.1)  │    │  (Weather API)  │
│ /weather?city=  │    │ via OpenRouter   │    │                 │
│     London      │    │ MCPTools Bridge  │    │ get_weather()   │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                         │
                                                         ▼
                                                ┌─────────────────┐
                                                │ OpenWeather API │
                                                │ (Free Tier)     │
                                                └─────────────────┘
```

## Quick Start

### 1. Install Dependencies

**Option A: Quick Install**
```bash
chmod +x install.sh
./install.sh
```

**Option B: Manual Install**
```bash
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Setup Environment Variables

```bash
cp .env.example .env
# Edit .env with your API keys
```

Get your API keys:
- **OpenWeather API**: [openweathermap.org/api](https://openweathermap.org/api) (free tier available)
- **OpenRouter API**: [openrouter.ai/settings/keys](https://openrouter.ai/settings/keys) (for DeepSeek access)

### 3. Test the Installation

```bash
# Test the MCP server directly
python test_weather.py

# If tests pass, start the full application
python agno_weather_agent.py
```

The API will be available at `http://localhost:8000`

## API Usage

### Get Weather Bucket

```bash
curl "http://localhost:8000/weather?city=London"
```

**Response:**
```json
{
  "city": "London",
  "bucket": "cloudy",
  "message": "The weather bucket for London is 'cloudy' - perfect for some chill ambient music!"
}
```

### Available Endpoints

- `GET /` - API information
- `GET /health` - Health check
- `GET /weather?city={city}` - Get weather bucket for city

## Weather Buckets

The agent maps weather conditions to music-friendly categories:

| Bucket | Weather Conditions | Music Suggestion |
|--------|-------------------|------------------|
| `sunny` | Clear skies | Upbeat, energetic music |
| `cloudy` | Overcast, fog, mist | Chill, ambient music |
| `rainy` | Rain, drizzle, thunderstorms | Cozy, introspective music |
| `windy` | Strong winds, storms | Dynamic, powerful music |
| `night` | Nighttime (regardless of conditions) | Calm, atmospheric music |

## MCP Server Details

### Tool Schema

```json
{
  "name": "get_weather",
  "description": "Get current weather for a city and return a weather bucket",
  "inputSchema": {
    "type": "object",
    "properties": {
      "city": {
        "type": "string",
        "description": "City name (e.g., 'London', 'New York', 'Tokyo')"
      }
    },
    "required": ["city"]
  },
  "outputSchema": {
    "type": "object",
    "properties": {
      "bucket": {
        "type": "string",
        "enum": ["sunny", "cloudy", "rainy", "windy", "night"]
      }
    }
  }
}
```

### Running MCP Server Standalone

```bash
python mcp_weather_server.py
```

The server uses stdio for MCP communication and can be integrated with any MCP-compatible client.

## Development

### Project Structure

```
weather-mcp-agent/
├── mcp_weather_server.py   # MCP server implementation
├── agno_weather_agent.py   # Agno agent + FastAPI app
├── mcp.json                # MCP manifest
├── requirements.txt        # Python dependencies
├── .env.example           # Environment variables template
└── README.md              # This file
```

### Testing Without API Keys

The MCP server includes mock data for development:

- If `OPENWEATHER_API_KEY` is not set, returns "sunny" as default
- Agent requires `OPENAI_API_KEY` to function

### Customizing Weather Logic

Edit `WEATHER_CONDITION_TO_BUCKET` in `mcp_weather_server.py` to modify weather-to-bucket mapping:

```python
WEATHER_CONDITION_TO_BUCKET = {
    800: "sunny",     # Clear sky
    801: "cloudy",    # Few clouds
    500: "rainy",     # Light rain
    # ... add your custom mappings
}
```

## Example Requests

### Sunny Weather
```bash
curl "http://localhost:8000/weather?city=Phoenix"
# Response: {"city": "Phoenix", "bucket": "sunny", "message": "..."}
```

### Rainy Weather
```bash
curl "http://localhost:8000/weather?city=Seattle"
# Response: {"city": "Seattle", "bucket": "rainy", "message": "..."}
```

### Night Time
```bash
curl "http://localhost:8000/weather?city=Tokyo"
# Response: {"city": "Tokyo", "bucket": "night", "message": "..."} (if it's nighttime in Tokyo)
```

## MCP Standards Compliance

This implementation follows the latest MCP specification (2025-06-18):

- ✅ JSON-RPC 2.0 protocol
- ✅ Tool schema validation
- ✅ Error handling
- ✅ Manifest file (`mcp.json`)
- ✅ Stateless operation
- ✅ Capability declaration

## Troubleshooting

### Import Errors
If you see MCP import errors:
```bash
pip install --upgrade model-context-protocol
# or try:
pip install mcp
```

### Dependencies Issues
```bash
# Clean install
rm -rf venv
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

### API Key Issues
- **OpenWeather**: Get free key at [openweathermap.org](https://openweathermap.org/api)
- **OpenRouter**: Required for DeepSeek access - get key at [openrouter.ai/settings/keys](https://openrouter.ai/settings/keys)
- Without OpenWeather key: MCP server will use mock data
- Without OpenRouter key: Agent won't work

### DeepSeek Model Benefits
- **Advanced Reasoning**: Superior logical thinking and problem-solving
- **Cost-Effective**: Very competitive pricing through OpenRouter
- **Fast Inference**: Quick response times for real-time applications
- **Instruction Following**: Excellent at following complex instructions
- **Structured Output**: Reliable JSON and formatted responses

### Testing Without Keys
- **MCP Server**: `python test_weather.py` to test weather logic with mock data
- **OpenRouter Setup**: `python test_openrouter_deepseek.py` to verify DeepSeek configuration
- **Full Integration**: `python live_weather_test.py` to test with real weather data

## License

MIT License - feel free to use this as a starting point for your own MCP projects!

## Contributing

This is a hackathon-ready minimal implementation. Feel free to extend it with:

- Multiple weather data sources
- More sophisticated music recommendations
- Historical weather data
- Location-based playlists
- Integration with music streaming APIs

Happy hacking! 🚀