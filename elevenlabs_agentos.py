#!/usr/bin/env python3
"""
ElevenLabs Music MCP Agent with AgentOS
Integrates our ElevenLabs MCP server with AgentOS UI
"""

import os
import logging
import time
import re
from textwrap import dedent

from agno.agent import Agent
from agno.app.fastapi import FastAPIApp
from agno.models.openrouter import OpenRouter
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
    agent_id="elevenlabs-music-mcp-agent",
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
agent_app = FastAPIApp(
    agents=[music_agent],
    app_id="elevenlabs-music-mcp-os",
    name="ElevenLabs Music MCP OS",
    description="Advanced AI music generation and recommendations powered by ElevenLabs AI music creation, MCP tools, and DeepSeek AI reasoning",
)

# Get the FastAPI app
app = agent_app.get_app()

# Shared creative brief helpers
STYLE_INSTRUMENTS = {
    "upbeat": ["electric guitar", "synth bass", "four-on-the-floor kick", "claps"],
    "electronic": ["analog synth pads", "side-chained bass", "crisp hi-hats"],
    "dynamic": ["driving drums", "pulsing bass", "stabs"],
    "ambient": ["soft pads", "tape-textured keys", "gentle swells"],
    "cozy": ["warm piano", "upright bass", "brush kit"],
    "acoustic": ["fingerstyle guitar", "hand percussion", "muted piano"],
    "jazz": ["upright bass", "shuffle drums", "muted trumpet"],
    "classical": ["chamber strings", "piano arpeggios", "woodwinds"],
    "chill": ["lo-fi keys", "vinyl texture", "soft snaps"],
}

STYLE_FALLBACK_CHAIN = [
    "upbeat",
    "electronic",
    "dynamic",
    "ambient",
    "cozy",
    "acoustic",
    "jazz",
    "classical",
    "chill",
]

STYLE_BY_INDICATOR = {
    "party": "upbeat",
    "formal": "classical",
    "professional": "ambient",
    "casual": "acoustic",
    "mixed": "chill",
}

STYLE_BY_DECISION = {
    "party": "upbeat",
    "chill": "chill",
    "focused": "ambient",
    "bored": "dynamic",
}

# Add custom endpoint for vibe-based music generation
from fastapi import HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any, Literal
import json

# Pydantic models for vibe processing
class RoomStatsAPI(BaseModel):
    # Visual metrics
    avgBrightness: float
    colorTempK: float
    motionLevel: float
    faces: Optional[int] = None
    smiles: Optional[int] = None
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


class StatsWindowAPI(BaseModel):
    start: int
    end: int
    sampleCount: int
    averagedStats: RoomStatsAPI
    latestStats: RoomStatsAPI

class VibeContext(BaseModel):
    timestamp: int
    sessionId: Optional[str] = None
    previousVibe: Optional[str] = None
    previousStyle: Optional[str] = None
    styleLockExpiresAt: Optional[int] = None
    briefVersion: Optional[str] = None


class TransitionMetadata(BaseModel):
    previousStyle: Optional[str] = None
    smoothness: Optional[float] = None


class PromptMetadata(BaseModel):
    style: Optional[str] = None
    description: Optional[str] = None
    vibeLabel: Optional[str] = None
    weatherSummary: Optional[str] = None
    decisionSummary: Optional[str] = None
    targetBpm: Optional[int] = None
    energy: Optional[float] = None
    warmth: Optional[float] = None
    formality: Optional[float] = None
    focus: Optional[float] = None
    acousticRatio: Optional[float] = None
    percussionIntensity: Optional[float] = None
    dynamics: Optional[float] = None
    vocalsAllowed: Optional[str] = None
    instrumentationHints: Optional[List[str]] = None
    moodKeywords: Optional[List[str]] = None
    environmentSummary: Optional[str] = None
    transition: Optional[TransitionMetadata] = None
    briefVersion: Optional[str] = None


class VibeDecisionAPI(BaseModel):
    vibeLabel: str
    suggestedBPM: int
    suggestedVolume: float
    spokenTip: str
    action: Optional[str] = None


class WeatherSnapshotAPI(BaseModel):
    location: Optional[str] = None
    description: Optional[str] = None
    temperature: Optional[float] = None
    feelsLike: Optional[float] = None
    humidity: Optional[int] = None
    uvIndex: Optional[float] = None
    cloudiness: Optional[int] = None
    timestamp: Optional[int] = None


class CreativeMusicBrief(BaseModel):
    style: str
    vibeLabel: str
    targetBpm: int
    energy: float
    warmth: float
    formality: float
    focus: float
    acousticRatio: float
    percussionIntensity: float
    dynamics: float
    vocalsAllowed: Literal['off', 'low', 'lead']
    instrumentationHints: List[str] = Field(default_factory=list)
    moodKeywords: List[str] = Field(default_factory=list)
    environmentSummary: Optional[str] = None
    weatherSummary: Optional[str] = None
    description: str
    transition: Optional[TransitionMetadata] = None


class FallbackPlan(BaseModel):
    strategy: Literal['local_playlist']
    reason: str
    suggestedStyle: Optional[str] = None


class VibeRequest(BaseModel):
    stats: RoomStatsAPI
    statsWindow: Optional[StatsWindowAPI] = None
    context: Optional[VibeContext] = None
    promptMetadata: Optional[PromptMetadata] = None
    decision: Optional[VibeDecisionAPI] = None
    weather: Optional[WeatherSnapshotAPI] = None
    brief: Optional[CreativeMusicBrief] = None

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
    fallback: Optional[FallbackPlan] = None


def clamp(value: float, min_value: float, max_value: float) -> float:
    return max(min_value, min(max_value, value))


def summarise_weather(weather: Optional[WeatherSnapshotAPI]) -> Optional[str]:
    if not weather:
        return None
    parts: List[str] = []
    if weather.location:
        parts.append(weather.location)
    if weather.description:
        parts.append(weather.description.lower())
    if weather.temperature is not None:
        parts.append(f"{int(weather.temperature)}°C")
    if weather.humidity is not None:
        parts.append(f"{weather.humidity}% humidity")
    return ", ".join(parts) if parts else None


def summarise_environment(stats: RoomStatsAPI) -> str:
    parts = [
        f"motion {int(clamp(stats.motionLevel, 0, 1) * 100)}%",
        f"crowd {int(clamp(stats.crowdDensity, 0, 1) * 100)}%",
        f"lighting {stats.lightingPattern}",
    ]
    if stats.dominantColors:
        parts.append(f"colors {', '.join(stats.dominantColors[:3])}")
    parts.append(f"audio energy {int(clamp(stats.audioEnergy, 0, 1) * 100)}%")
    return " | ".join(parts)


def instrumentation_for_style(style: str) -> List[str]:
    return STYLE_INSTRUMENTS.get(style, [f"elements inspired by {style}"])

@app.post("/api/vibe/generate-music", response_model=VibeResponse)
async def generate_vibe_music(request: VibeRequest):
    """
    Generate music based on vibe analysis from webcam data
    """
    try:
        stats = request.stats
        prompt_metadata = request.promptMetadata
        decision = request.decision
        weather = request.weather

        brief = request.brief
        fallback_brief_generated = False

        def axis_value(candidate: Optional[float], default: float) -> float:
            return clamp(float(candidate), 0.0, 1.0) if candidate is not None else default

        if brief is None:
            fallback_brief_generated = True
            if prompt_metadata and prompt_metadata.style:
                base_style = prompt_metadata.style
            elif decision and decision.vibeLabel in STYLE_BY_DECISION:
                base_style = STYLE_BY_DECISION[decision.vibeLabel]
            else:
                base_style = STYLE_BY_INDICATOR.get(stats.styleIndicator, "chill")

            if stats.lightingPattern in ("strobe", "dynamic") and base_style == "upbeat":
                base_style = "electronic"

            vibe_label = (
                prompt_metadata.vibeLabel if prompt_metadata and prompt_metadata.vibeLabel else
                (decision.vibeLabel if decision else "focused")
            )

            target_bpm_seed = (
                prompt_metadata.targetBpm if prompt_metadata and prompt_metadata.targetBpm is not None else
                (decision.suggestedBPM if decision else int(78 + clamp(stats.motionLevel, 0, 1) * 60))
            )

            energy_default = clamp(stats.motionLevel * 0.6 + stats.audioEnergy * 0.4, 0.0, 1.0)
            warmth_default = clamp(0.75 - ((stats.colorTempK - 1800) / (8500 - 1800)) * 0.6 + (0.1 if stats.avgBrightness < 0.35 else 0), 0.0, 1.0)
            formality_base = 0.85 if stats.styleIndicator in ("formal", "professional") else (0.35 if stats.styleIndicator == "casual" else 0.5)
            formality_default = clamp(formality_base + (0.1 if vibe_label == "focused" else 0) - (0.1 if stats.crowdDensity > 0.7 else 0), 0.0, 1.0)
            focus_default = clamp(0.6 - clamp(stats.noiseLevel, 0, 1) * 0.35 + (0.1 if stats.speechProbability > 0.55 else 0) + (0.15 if vibe_label == "focused" else 0), 0.0, 1.0)
            acoustic_bias = (
                0.65 if stats.styleIndicator in ("casual", "formal") else
                0.55 if stats.styleIndicator == "professional" else
                0.3 if stats.styleIndicator == "party" else
                0.5
            )
            acoustic_ratio_default = clamp(acoustic_bias + (warmth_default * 0.2) - (clamp(stats.audioEnergy, 0, 1) * 0.2), 0.0, 1.0)
            percussion_intensity_default = clamp(clamp(stats.audioEnergy, 0, 1) * 0.5 + clamp(stats.motionLevel, 0, 1) * 0.35 + (0.2 if vibe_label == "bored" else 0), 0.0, 1.0)
            dynamics_default = clamp(0.4 + clamp(stats.motionLevel, 0, 1) * 0.15 + (-0.1 if stats.avgBrightness < 0.25 else 0) + (0.1 if vibe_label == "party" else 0), 0.0, 1.0)

            vocals_allowed = "off"

            instrumentation_hints = (
                prompt_metadata.instrumentationHints
                if prompt_metadata and prompt_metadata.instrumentationHints
                else instrumentation_for_style(base_style)
            )
            if "no vocals" not in instrumentation_hints:
                instrumentation_hints.append("no vocals")
            if "instrumental arrangement" not in instrumentation_hints:
                instrumentation_hints.append("instrumental arrangement")
            instrumentation_hints = list(dict.fromkeys(instrumentation_hints))
            mood_keywords = (
                prompt_metadata.moodKeywords
                if prompt_metadata and prompt_metadata.moodKeywords
                else [vibe_label, base_style]
            )
            environment_summary = (
                prompt_metadata.environmentSummary
                if prompt_metadata and prompt_metadata.environmentSummary
                else summarise_environment(stats)
            )
            weather_summary = (
                prompt_metadata.weatherSummary
                if prompt_metadata and prompt_metadata.weatherSummary
                else summarise_weather(weather)
            )

            description = (
                prompt_metadata.description
                if prompt_metadata and prompt_metadata.description
                else f"Compose {base_style} music that supports a {vibe_label} vibe. Keep tempo near {int(target_bpm_seed)} BPM and respect: {environment_summary}."
            )

            brief = CreativeMusicBrief(
                style=base_style,
                vibeLabel=vibe_label,
                targetBpm=int(target_bpm_seed),
                energy=axis_value(prompt_metadata.energy if prompt_metadata else None, energy_default),
                warmth=axis_value(prompt_metadata.warmth if prompt_metadata else None, warmth_default),
                formality=axis_value(prompt_metadata.formality if prompt_metadata else None, formality_default),
                focus=axis_value(prompt_metadata.focus if prompt_metadata else None, focus_default),
                acousticRatio=axis_value(prompt_metadata.acousticRatio if prompt_metadata else None, acoustic_ratio_default),
                percussionIntensity=axis_value(prompt_metadata.percussionIntensity if prompt_metadata else None, percussion_intensity_default),
                dynamics=axis_value(prompt_metadata.dynamics if prompt_metadata else None, dynamics_default),
                vocalsAllowed=vocals_allowed,
                instrumentationHints=instrumentation_hints,
                moodKeywords=mood_keywords,
                environmentSummary=environment_summary,
                weatherSummary=weather_summary,
                description=description,
                transition=prompt_metadata.transition if prompt_metadata else None,
            )
        else:
            instrumentation = list(brief.instrumentationHints or [])
            if not instrumentation:
                instrumentation = instrumentation_for_style(brief.style)
            instrumentation.extend(["instrumental arrangement", "no vocals"])
            instrumentation = list(dict.fromkeys(instrumentation))

            brief_updates: Dict[str, Any] = {
                "instrumentationHints": instrumentation,
                "vocalsAllowed": "off",
            }
            if not brief.weatherSummary:
                brief_updates["weatherSummary"] = summarise_weather(weather)
            if not brief.environmentSummary:
                brief_updates["environmentSummary"] = summarise_environment(stats)
            if not brief.moodKeywords:
                brief_updates["moodKeywords"] = [brief.vibeLabel, brief.style]
            brief = brief.copy(update=brief_updates)

        selected_style = brief.style
        description = brief.description
        weather_summary = brief.weatherSummary

        brief_version = None
        if prompt_metadata and prompt_metadata.briefVersion:
            brief_version = prompt_metadata.briefVersion
        elif request.context and request.context.briefVersion:
            brief_version = request.context.briefVersion

        brief_payload = brief.dict(exclude_none=True)
        brief_payload["vocalsAllowed"] = "off"
        if brief_version:
            brief_payload["briefVersion"] = brief_version
        brief_payload["source"] = "reconstructed" if fallback_brief_generated else "frontend"

        logger.info(
            "🎯 Creative brief received – style: %s | bpm: %s | energy: %.2f | vocals: %s (source=%s)",
            brief.style,
            brief.targetBpm,
            brief.energy,
            brief.vocalsAllowed,
            brief_payload["source"],
        )

        if brief.transition and brief.transition.previousStyle:
            logger.info(
                "🔁 Transition from %s with smoothness %.2f",
                brief.transition.previousStyle,
                brief.transition.smoothness or 0.6,
            )

        creative_brief_json = json.dumps(brief_payload, indent=2)

        sensor_snapshot = json.dumps(
            {
                "styleIndicator": stats.styleIndicator,
                "motionLevel": round(stats.motionLevel, 3),
                "crowdDensity": round(stats.crowdDensity, 3),
                "audioEnergy": round(stats.audioEnergy, 3),
                "avgBrightness": round(stats.avgBrightness, 3),
                "colorVariance": round(stats.colorVariance, 3),
                "dominantColors": stats.dominantColors[:3],
                "lockExpiresAt": request.context.styleLockExpiresAt if request.context else None,
            },
            indent=2,
        )

        instrumentation_text = ", ".join(brief.instrumentationHints) if brief.instrumentationHints else "balanced instrumentation"
        mood_text = ", ".join(brief.moodKeywords) if brief.moodKeywords else brief.vibeLabel
        transition_text = (
            f"transition smoothly from {brief.transition.previousStyle}"
            if brief.transition and brief.transition.previousStyle
            else "stay coherent with the current vibe"
        )

        prompt = dedent(f"""You are composing the very next track for a live venue. Follow the creative brief exactly—do not override style or constraints.

Creative brief (strict JSON):
{creative_brief_json}

Live sensor snapshot (context only):
{sensor_snapshot}

Requirements:
- Vocals must be {brief.vocalsAllowed}.
- Keep tempo near {brief.targetBpm} BPM with dynamics about {int(brief.dynamics * 100)}%.
- Lean into instrumentation: {instrumentation_text}.
- Evoke mood keywords: {mood_text}.
- {transition_text}.

Call the generate_music tool with exactly these parameters:
- style: {brief.style}
- description: \"\"\"{description}\"\"\"
- duration: 60

After the tool call, reply with a 1–2 sentence confirmation describing how the track satisfies the brief.
""")

        # Get a chat completion from the music agent
        # Run the agent directly with the constructed prompt
        start_time = time.time()
        temp_dir = "/tmp/elevenlabs_music"
        existing_files = set()
        if os.path.isdir(temp_dir):
            existing_files = {os.path.join(temp_dir, f) for f in os.listdir(temp_dir)}

        response = await music_agent.arun(prompt)

        logger.debug("🎛️ Agent raw response object: %s", type(response))

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

        logger.debug("📝 Agent response text: %s", response_text)

        # Try to extract a file path hinted by the agent response
        hinted_path = None
        file_path_match = re.search(r"File Path[^`]*`([^`]+)`", response_text)
        if file_path_match:
            candidate = file_path_match.group(1).strip()
            if candidate:
                hinted_path = candidate

        if hinted_path and not os.path.isabs(hinted_path):
            # If the model hallucinated a relative path, map it into our temp dir
            hinted_path = os.path.join("/tmp/elevenlabs_music", os.path.basename(hinted_path))

        resolved_music_path = hinted_path if hinted_path and os.path.isfile(hinted_path) else None

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

        if generated_file and os.path.isfile(generated_file):
            resolved_music_path = generated_file

        music_info = None
        if resolved_music_path and os.path.isfile(resolved_music_path):
            filename = os.path.basename(resolved_music_path)
            music_info = MusicResponse(
                url=resolved_music_path,
                filename=filename,
                style=selected_style,
                description=description,
                duration=60
            )

        # If the agent did not surface a usable file path, fall back to a direct API call
        failure_reason = None

        fallback_plan: Optional[FallbackPlan] = None
        if not music_info:
            try:
                from mcp_elevenlabs_server import _call_elevenlabs_api as call_elevenlabs_music

                logger.info("🎧 Falling back to direct ElevenLabs API call")
                music_result = await call_elevenlabs_music(prompt, selected_style, 60)
                fallback_path = music_result.get("music_file") if isinstance(music_result, dict) else None

                if fallback_path and os.path.isfile(fallback_path):
                    music_info = MusicResponse(
                        url=fallback_path,
                        filename=os.path.basename(fallback_path),
                        style=selected_style,
                        description=description,
                        duration=music_result.get("duration_seconds", 60) or 60,
                    )
                else:
                    if isinstance(music_result, dict) and music_result.get("message"):
                        failure_reason = music_result.get("message")
                    logger.warning(
                        "🎧 ElevenLabs fallback did not return an audio file: %s",
                        music_result.get("message") if isinstance(music_result, dict) else music_result,
                    )
            except Exception as fallback_error:
                logger.error(f"Fallback ElevenLabs call failed: {fallback_error}")
                failure_reason = str(fallback_error)

        if not music_info:
            fallback_message = failure_reason or "Music file path not found in response"
            fallback_plan = FallbackPlan(
                strategy="local_playlist",
                reason=fallback_message,
                suggestedStyle=selected_style,
            )
            logger.warning(
                "🎼 Using local playlist fallback for style %s (reason: %s)",
                selected_style,
                fallback_plan.reason,
            )
            failure_reason = fallback_message

        success = bool(music_info) or fallback_plan is not None
        vibe_description = response_text or (
            f"Fallback playlist suggested for {selected_style}" if fallback_plan else None
        )

        return VibeResponse(
            success=success,
            music=music_info,
            vibeDescription=vibe_description,
            error=failure_reason if (failure_reason and not music_info) else None,
            fallback=fallback_plan,
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
    agent_app.serve(app="elevenlabs_agentos:app", port=7777)
