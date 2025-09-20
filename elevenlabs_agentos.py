#!/usr/bin/env python3
"""
ElevenLabs Music MCP Agent with AgentOS
Integrates our ElevenLabs MCP server with AgentOS UI
"""

import os
import logging
import time
from textwrap import dedent

from agno.agent import Agent
from agno.models.openrouter import OpenRouter
from agno.os import AgentOS
from agno.tools.mcp import MultiMCPTools
from dotenv import load_dotenv

# Setup logging
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# Check required API keys
openrouter_key = os.getenv("OPENROUTER_API_KEY")
elevenlabs_key = os.getenv("ELEVENLABS_API_KEY")

if not openrouter_key:
    raise ValueError("OPENROUTER_API_KEY environment variable is required")

print("🎵 Starting ElevenLabs Music MCP Agent with AgentOS...")
print(f"🔑 OpenRouter API: {'✅ Set' if openrouter_key else '❌ Missing'}")
print(f"🔑 ElevenLabs API: {'✅ Set' if elevenlabs_key else '⚠️ Missing (will use mock music generation)'}")

# Create MCPTools instance with command string and environment variables
# This will start the MCP server as a subprocess using stdio transport
# Pass ElevenLabs API key to the subprocess
# Use MultiMCPTools to properly pass environment variables
env_vars = {}
if elevenlabs_key:
    env_vars["ELEVENLABS_API_KEY"] = elevenlabs_key

# Try to configure timeout using server_params approach
from mcp import StdioServerParameters

server_params = StdioServerParameters(
    command="python3",
    args=["mcp_elevenlabs_server.py"],
    env={
        **env_vars,
        # Add timeout as environment variable that we'll read in the server
        "MCP_CLIENT_TIMEOUT": "120"  # 2 minutes
    }
)

# Use MultiMCPTools with both approaches - fallback to command if server_params doesn't work
try:
    from agno.tools.mcp import MCPTools
    # Try MCPTools with server_params first
    mcp_tools = MCPTools(server_params=server_params, timeout_seconds=120)
except Exception as e:
    logger.warning(f"Could not configure MCPTools with server_params: {e}")
    # Fallback to MultiMCPTools
    mcp_tools = MultiMCPTools(
        commands=["python3 mcp_elevenlabs_server.py"],
        env=env_vars,
        timeout_seconds=120
    )

# Create the music agent
music_agent = Agent(
    id="elevenlabs-music-mcp-agent",
    name="ElevenLabs Music Agent 🎵",
    tools=[mcp_tools],
    instructions=dedent("""\
        You are an advanced AI music generation agent powered by ElevenLabs' cutting-edge music creation technology.

        **Your capabilities:**
        - Generate custom AI music tracks using the `generate_music` tool
        - Support multiple music styles: upbeat, chill, cozy, dynamic, ambient, classical, rock, jazz, electronic, acoustic
        - Create music from 5 to 30 seconds in duration
        - Provide detailed music descriptions and recommendations

        **Music Style Guide:**
        - 🎉 **Upbeat**: Energetic, positive music perfect for parties and celebrations
        - 😌 **Chill**: Relaxed ambient vibes great for studying or relaxing
        - 🏠 **Cozy**: Warm, intimate music perfect for quiet moments
        - ⚡ **Dynamic**: Powerful, driving music with strong energy
        - 🌌 **Ambient**: Atmospheric, meditative sounds for deep focus
        - 🎭 **Classical**: Beautiful orchestral arrangements and compositions
        - 🎸 **Rock**: Guitar-driven music with strong rhythm and attitude
        - 🎺 **Jazz**: Sophisticated improvised melodies and harmonies
        - 🎹 **Electronic**: Modern synthesized music with digital beats
        - 🎵 **Acoustic**: Natural, organic sounds with real instruments

        **Workflow:**
        1. Understand the user's request for music style and description
        2. Use the `generate_music` tool with appropriate style and custom description
        3. Provide the generated music file information
        4. Give additional music recommendations in the same style
        5. Be enthusiastic and creative about the AI-generated music

        **Response Style:**
        1. Always generate AI music using the generate_music tool
        2. Provide detailed information about the generated track
        3. Give manual music recommendations in the same style
        4. Use emojis to make responses engaging and visual
        5. Explain the musical characteristics and mood
        6. Be creative and passionate about music

        **Example Response Flow:**
        "I'll create some amazing jazz music for you! 🎺

        🎵 **AI-Generated Track**: Creating a custom 15-second jazz track with smooth piano and sophisticated harmonies...

        [Generated music file information]

        🎼 **Style Recommendations:**
        🎵 **Smooth Jazz**: Miles Davis, Bill Evans, Dave Brubeck
        🎵 **Contemporary**: Kamasi Washington, Robert Glasper, Brad Mehldau
        🎵 **Vocal Jazz**: Ella Fitzgerald, Billie Holiday, Norah Jones

        The AI-generated track captures that classic jazz sophistication perfectly! 🎶"

        **IMPORTANT**: Always use the generate_music tool to create custom tracks based on user requests!
    """),
    model=OpenRouter(
        id="deepseek/deepseek-chat-v3.1",
        api_key=openrouter_key
    ),
    markdown=True,
    tool_call_limit=3,
    store_events=True,
    events_to_skip=[],
)

# Create AgentOS instance
agent_os = AgentOS(
    os_id="elevenlabs-music-mcp-os",
    description="Advanced AI music generation and recommendations powered by ElevenLabs AI music creation, MCP tools, and DeepSeek AI reasoning",
    agents=[music_agent],
)

# Get the FastAPI app
app = agent_os.get_app()

# Add custom endpoint for vibe-based music generation
from fastapi import HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import json

# Pydantic models for vibe processing
class RoomStatsAPI(BaseModel):
    # Visual metrics
    avgBrightness: float
    colorTempK: float
    motionLevel: float
    # Style detection metrics
    motionZones: List[float]
    crowdDensity: float
    styleIndicator: str  # "formal" | "casual" | "party" | "professional" | "mixed"
    dominantColors: List[str]
    colorVariance: float
    lightingPattern: str  # "steady" | "dynamic" | "strobe" | "dim"
    # Audio metrics
    audioVolume: float
    audioEnergy: float
    noiseLevel: float
    speechProbability: float
    pitch: float
    spectralCentroid: float

class VibeContext(BaseModel):
    timestamp: int
    sessionId: Optional[str] = None
    previousVibe: Optional[str] = None

class PromptMetadata(BaseModel):
    style: Optional[str] = None
    description: Optional[str] = None


class VibeRequest(BaseModel):
    stats: RoomStatsAPI
    context: Optional[VibeContext] = None
    promptMetadata: Optional[PromptMetadata] = None

class MusicResponse(BaseModel):
    url: str
    filename: str
    style: str
    description: str
    duration: int

class VibeResponse(BaseModel):
    success: bool
    music: Optional[MusicResponse] = None
    error: Optional[str] = None
    vibeDescription: Optional[str] = None

@app.post("/api/vibe/generate-music", response_model=VibeResponse)
async def generate_vibe_music(request: VibeRequest):
    """
    Generate music based on vibe analysis from webcam data
    """
    try:
        stats = request.stats
        prompt_metadata = request.promptMetadata

        # Create a detailed prompt based on the vibe analysis
        style_map = {
            "party": "upbeat",
            "formal": "classical",
            "professional": "ambient",
            "casual": "acoustic",
            "mixed": "chill"
        }

        selected_style = prompt_metadata.style if prompt_metadata and prompt_metadata.style else style_map.get(stats.styleIndicator, "chill")

        # DEBUG: Log received stats
        logger.info(f"🎯 Vibe Analysis - crowdDensity: {stats.crowdDensity:.2f}, motionLevel: {stats.motionLevel:.2f}, audioEnergy: {stats.audioEnergy:.2f}, brightness: {stats.avgBrightness:.2f}")
        logger.info(f"🎯 Initial style: {selected_style}")

        # Adjust style based on crowd density and motion - BORED DETECTION
        if stats.crowdDensity > 0.6 and stats.motionLevel > 0.5:
            selected_style = "upbeat"
            logger.info(f"🎯 PARTY detected -> {selected_style}")
        elif stats.crowdDensity < 0.2 and stats.motionLevel < 0.2:
            # BORED: Very low activity - force energetic music
            selected_style = "upbeat"
            logger.info(f"🎯 BORED (low crowd+motion) detected -> {selected_style}")
        elif stats.audioEnergy < 0.2 and stats.motionLevel < 0.3:
            # BORED: Low audio and motion - force dynamic music
            selected_style = "dynamic"
            logger.info(f"🎯 BORED (low audio+motion) detected -> {selected_style}")
        elif stats.avgBrightness < 0.3:
            selected_style = "ambient"
            logger.info(f"🎯 DIM lighting detected -> {selected_style}")
        elif stats.audioEnergy > 0.5:
            selected_style = "dynamic"
            logger.info(f"🎯 HIGH audio energy detected -> {selected_style}")
        else:
            logger.info(f"🎯 No special conditions, keeping -> {selected_style}")

        # Create description
        crowd_desc = "high energy crowd" if stats.crowdDensity > 0.6 else \
                    "moderate activity" if stats.crowdDensity > 0.3 else \
                    "intimate setting"

        lighting_desc = {
            "strobe": "dynamic lighting effects",
            "dynamic": "changing ambient lighting",
            "dim": "soft intimate lighting",
            "steady": "consistent bright lighting"
        }.get(stats.lightingPattern, "ambient lighting")

        description = prompt_metadata.description if prompt_metadata and prompt_metadata.description else f"{selected_style} music for {crowd_desc} with {lighting_desc}, motion level {int(stats.motionLevel * 100)}%"

        # Use the music agent to generate music
        prompt = f"""Generate {selected_style} music based on this live vibe analysis:

🎯 **Detected Environment:**
- Style: {stats.styleIndicator}
- Crowd density: {int(stats.crowdDensity * 100)}%
- Motion level: {int(stats.motionLevel * 100)}%
- Lighting: {stats.lightingPattern}
- Audio energy: {int(stats.audioEnergy * 100)}%
- Brightness: {int(stats.avgBrightness * 100)}%
- Color variance: {int(stats.colorVariance * 100)}%
- Dominant colors: {', '.join(stats.dominantColors[:3]) if stats.dominantColors else 'none detected'}

🎵 **Music Request:**
Please create a {selected_style} music track with this description: "{description}"

Use the generate_music tool with:
- Style: {selected_style}
- Description: {description}
- Duration: 60 seconds

Make sure to generate the actual music file and provide the file path information!"""

        # Get a chat completion from the music agent
        # Run the agent directly with the constructed prompt
        start_time = time.time()
        temp_dir = "/tmp/elevenlabs_music"
        existing_files = set()
        if os.path.isdir(temp_dir):
            existing_files = {os.path.join(temp_dir, f) for f in os.listdir(temp_dir)}

        response = await music_agent.arun(prompt)

        # Extract the response content in a version-tolerant way
        response_text = None
        for attr in ("output_text", "content", "message", "text"):
            if hasattr(response, attr):
                value = getattr(response, attr)
                if value:
                    response_text = value
                    break

        if response_text is None and isinstance(response, dict):
            response_text = (
                response.get("output_text")
                or response.get("content")
                or response.get("message")
            )

        if response_text is None:
            response_text = str(response)

        # Detect newly generated audio file from ElevenLabs MCP server
        generated_file = None
        latest_mtime = start_time
        if os.path.isdir(temp_dir):
            for file_name in os.listdir(temp_dir):
                file_path = os.path.join(temp_dir, file_name)
                try:
                    file_mtime = os.path.getmtime(file_path)
                except OSError:
                    continue

                if file_path in existing_files:
                    # Skip files that existed before this request unless they were
                    # modified after the run started (e.g. overwritten)
                    if file_mtime <= start_time:
                        continue

                if file_mtime >= latest_mtime:
                    latest_mtime = file_mtime
                    generated_file = file_path

        music_info = None
        if generated_file and os.path.isfile(generated_file):
            filename = os.path.basename(generated_file)
            music_info = MusicResponse(
                url=generated_file,
                filename=filename,
                style=selected_style,
                description=description,
                duration=60
            )

        return VibeResponse(
            success=True,
            music=music_info,
            vibeDescription=response_text,
            error=None if music_info else "Music file path not found in response"
        )

    except Exception as e:
        logger.error(f"Vibe music generation failed: {e}")
        return VibeResponse(
            success=False,
            error=str(e)
        )

@app.get("/api/vibe/health")
async def vibe_health():
    """Health check for vibe processing endpoint"""
    return {
        "status": "healthy",
        "agent": music_agent.name,
        "model": music_agent.model.id if hasattr(music_agent.model, 'id') else 'unknown'
    }

if __name__ == "__main__":
    print("🚀 ElevenLabs Music Generation MCP AgentOS starting!")
    print("📍 App Interface: http://localhost:7777")
    print("📖 API Docs: http://localhost:7777/docs")
    print("⚙️ Configuration: http://localhost:7777/config")
    print("\n💡 Try these example prompts in the AgentOS interface:")
    print("   • Generate upbeat electronic music for a party")
    print("   • Create some chill ambient music for studying")
    print("   • Make a cozy jazz track for a quiet evening")
    print("   • Generate dynamic rock music with powerful energy")
    print("   • Create classical music with orchestral arrangements")
    print("   • Make ambient music perfect for meditation")
    print("\n🎵 Available Music Styles:")
    print("   🎉 Upbeat → Energetic, positive vibes")
    print("   😌 Chill → Relaxed ambient sounds")
    print("   🏠 Cozy → Warm, intimate music")
    print("   ⚡ Dynamic → Powerful, driving energy")
    print("   🌌 Ambient → Atmospheric, meditative")
    print("   🎭 Classical → Beautiful orchestral arrangements")
    print("   🎸 Rock → Guitar-driven with strong rhythm")
    print("   🎺 Jazz → Sophisticated improvisational")
    print("   🎹 Electronic → Modern synthesized beats")
    print("   🎵 Acoustic → Natural, organic instruments")
    print("\n🎯 The agent will:")
    print("   1. Generate custom AI music tracks with ElevenLabs (5-30 seconds)")
    print("   2. Provide detailed music style recommendations")
    print("   3. Save generated music files to /tmp/elevenlabs_music/")
    print("   4. Offer creative music suggestions and descriptions")

    # Note: Don't use reload=True with MCP tools to avoid lifespan issues
    agent_os.serve(app="elevenlabs_agentos:app", port=7777)
