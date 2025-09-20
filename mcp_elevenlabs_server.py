#!/usr/bin/env python3

import asyncio
import os
import logging
import json
from typing import Dict, Any
import aiohttp
import mcp.types as types
from mcp.server.lowlevel import Server, NotificationOptions
from mcp.server.models import InitializationOptions
import mcp.server.stdio
import base64
import tempfile
from datetime import datetime

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create a server instance
server = Server("elevenlabs-music-mcp-server")

# API configuration
elevenlabs_api_key = os.getenv("ELEVENLABS_API_KEY")
if not elevenlabs_api_key:
    logger.warning("ELEVENLABS_API_KEY not found. Music generation will be mocked.")

# Music style prompts for different genres
MUSIC_STYLE_PROMPTS = {
    "upbeat": "Upbeat energetic pop music with bright melodies and positive vibes",
    "chill": "Chill ambient indie music with soft acoustic tones and relaxing atmosphere",
    "cozy": "Cozy jazz with gentle piano and warm intimate feeling",
    "dynamic": "Dynamic electronic music with powerful beats and driving energy",
    "ambient": "Calm atmospheric ambient music for relaxation and meditation",
    "classical": "Beautiful classical music with orchestral arrangements",
    "rock": "Energetic rock music with driving guitars and strong rhythm",
    "jazz": "Smooth jazz with improvised melodies and sophisticated harmonies",
    "electronic": "Modern electronic music with synthesizers and digital beats",
    "acoustic": "Intimate acoustic music with natural instruments and organic sound"
}


@server.list_tools()
async def handle_list_tools() -> list[types.Tool]:
    """List available tools"""
    return [
        types.Tool(
            name="generate_music",
            description="Generate custom AI music using ElevenLabs based on style and description",
            inputSchema={
                "type": "object",
                "properties": {
                    "style": {
                        "type": "string",
                        "description": "Music style (upbeat/chill/cozy/dynamic/ambient/classical/rock/jazz/electronic/acoustic)",
                        "enum": ["upbeat", "chill", "cozy", "dynamic", "ambient", "classical", "rock", "jazz", "electronic", "acoustic"]
                    },
                    "description": {
                        "type": "string",
                        "description": "Custom description for the music to be generated"
                    },
                    "duration_seconds": {
                        "type": "number",
                        "description": "Duration of the music in seconds (default: 60, max: 180)",
                        "minimum": 5,
                        "maximum": 180
                    }
                },
                "required": ["style", "description"]
            }
        )
    ]


@server.call_tool()
async def handle_call_tool(name: str, arguments: Dict[str, Any]) -> list[types.TextContent]:
    """Handle tool calls"""
    if name == "generate_music":
        return await _generate_music(arguments)
    else:
        raise ValueError(f"Unknown tool: {name}")




async def _generate_music(arguments: Dict[str, Any]) -> list[types.TextContent]:
    """Generate music based on style and description using ElevenLabs API"""
    try:
        style = arguments.get("style")
        description = arguments.get("description", "")
        duration_seconds = arguments.get("duration_seconds", 60)

        if not style or style not in MUSIC_STYLE_PROMPTS:
            return [types.TextContent(type="text", text="Invalid style. Must be one of: upbeat, chill, cozy, dynamic, ambient, classical, rock, jazz, electronic, acoustic")]

        # Get the base music prompt for this style
        base_prompt = MUSIC_STYLE_PROMPTS[style]

        # Enhance the prompt with custom description
        enhanced_prompt = f"{base_prompt}. {description}"

        # Generate music using ElevenLabs API
        music_result = await _call_elevenlabs_api(enhanced_prompt, style, duration_seconds)

        return [types.TextContent(
            type="text",
            text=json.dumps(music_result)
        )]

    except Exception as e:
        logger.error(f"Error generating music: {e}")
        return [types.TextContent(type="text", text=f"Error generating music: {str(e)}")]


async def _call_elevenlabs_api(prompt: str, style: str, duration_seconds: int) -> Dict[str, Any]:
    """Call ElevenLabs Music API to generate music"""
    if not elevenlabs_api_key:
        # Mock data for development
        logger.info(f"Mocking music generation for {style} style")
        return {
            "status": "success",
            "style": style,
            "duration_seconds": duration_seconds,
            "prompt": prompt,
            "music_file": None,
            "message": "Music generation mocked - ELEVENLABS_API_KEY not provided",
            "recommendation": f"Perfect {style} style music! The generated track would match this vibe perfectly."
        }

    try:
        # Prepare the request for ElevenLabs Music API
        url = "https://api.elevenlabs.io/v1/music"
        headers = {
            "xi-api-key": elevenlabs_api_key,
            "Content-Type": "application/json"
        }

        # Request payload - limit prompt to 2000 chars and use custom duration
        payload = {
            "prompt": prompt[:2000],  # Ensure prompt is under 2000 characters
            "music_length_ms": duration_seconds * 1000,  # Convert seconds to milliseconds
            "output_format": "mp3_44100_128"
        }

        logger.info(f"🎵 Starting {duration_seconds}-second music generation for {style} style...")

        import time
        start_time = time.time()

        # Set a longer timeout for music generation (60 seconds should be enough for longer tracks)
        timeout = aiohttp.ClientTimeout(total=60)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            logger.info(f"🎵 Sending request to ElevenLabs API...")
            async with session.post(url, headers=headers, json=payload) as response:
                logger.info(f"🎵 Received response status: {response.status} after {time.time() - start_time:.1f}s")
                if response.status != 200:
                    logger.error(f"ElevenLabs API error: {response.status}")
                    error_text = await response.text()
                    logger.error(f"ElevenLabs API error details: {error_text}")

                    return {
                        "status": "error",
                        "style": style,
                        "duration_seconds": duration_seconds,
                        "prompt": prompt,
                        "music_file": None,
                        "message": f"ElevenLabs API error: {response.status}",
                        "recommendation": f"Although music generation failed, {style} style music would be perfect for the intended vibe!"
                    }

                # Get the audio data
                audio_data = await response.read()

                # Save audio to a temporary file
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                filename = f"elevenlabs_music_{style}_{timestamp}.mp3"

                # Create temp directory if it doesn't exist
                temp_dir = "/tmp/elevenlabs_music"
                os.makedirs(temp_dir, exist_ok=True)

                file_path = os.path.join(temp_dir, filename)

                with open(file_path, "wb") as f:
                    f.write(audio_data)

                logger.info(f"Generated music saved to: {file_path}")

                return {
                    "status": "success",
                    "style": style,
                    "duration_seconds": duration_seconds,
                    "prompt": prompt,
                    "music_file": file_path,
                    "message": f"Successfully generated {duration_seconds}-second music track in {style} style",
                    "recommendation": f"Perfect {style} style music! The generated track captures the musical mood beautifully."
                }

    except Exception as e:
        logger.error(f"Error calling ElevenLabs API: {e}")
        return {
            "status": "error",
            "style": style,
            "duration_seconds": duration_seconds,
            "prompt": prompt,
            "music_file": None,
            "message": f"Error generating music: {str(e)}",
            "recommendation": f"Although music generation failed, {style} style music would be perfect for this type of musical atmosphere!"
        }


async def main():
    """Main entry point"""
    logger.info("Starting ElevenLabs Music MCP Server...")

    async with mcp.server.stdio.stdio_server() as (read_stream, write_stream):
        await server.run(
            read_stream,
            write_stream,
            InitializationOptions(
                server_name="elevenlabs-music-mcp-server",
                server_version="1.0.0",
                capabilities=server.get_capabilities(
                    notification_options=NotificationOptions(),
                    experimental_capabilities={},
                ),
            ),
        )

if __name__ == "__main__":
    asyncio.run(main())