#!/usr/bin/env python3
"""Thin ElevenLabs Music API wrapper used by the AgentOS backend.

The helpers in this module submit prompts to the ElevenLabs Music REST API and
persist the resulting audio files to a temporary directory so the frontend can
stream them immediately. The module can also be executed directly from the
command line for manual testing.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
import time
import uuid
from pathlib import Path
from typing import Any, Dict, Optional

import aiohttp
from dotenv import load_dotenv

# Ensure environment variables from .env are available when executed directly
load_dotenv()

ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY")
MUSIC_OUTPUT_DIR = Path(os.environ.get("ELEVENLABS_MUSIC_DIR", "/tmp/elevenlabs_music"))
MUSIC_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

ELEVENLABS_MUSIC_ENDPOINT = os.environ.get(
    "ELEVENLABS_MUSIC_ENDPOINT",
    "https://api.elevenlabs.io/v1/music",
)

DEFAULT_MODEL_ID = os.environ.get("ELEVENLABS_MUSIC_MODEL", "music_v1")
DEFAULT_OUTPUT_FORMAT = os.environ.get("ELEVENLABS_MUSIC_FORMAT", "mp3_44100_128")


class ElevenLabsAPIError(RuntimeError):
    """Raised when ElevenLabs returns an error payload or HTTP failure."""


async def _call_elevenlabs_api(
    prompt: str,
    style: Optional[str] = None,
    duration_seconds: int = 60,
) -> Dict[str, Any]:
    """Generate a music track via the ElevenLabs REST API.

    Args:
        prompt: The creative brief to send to ElevenLabs. This is augmented with
            the requested ``style`` to nudge the generation.
        style: Optional musical style requested by the caller.
        duration_seconds: Desired duration of the track. The public API expects
            milliseconds, and is capped between ~10s and 5 minutes.

    Returns:
        A dictionary with keys:
            ``music_file`` (absolute path to the generated file on disk),
            ``duration_seconds`` (actual length requested),
            ``mime_type`` (Content-Type returned by the API), and
            ``message`` (only populated when an error occurs).

    Raises:
        ElevenLabsAPIError: When the API key is missing, the HTTP call fails, or
            a non-OK response is returned.
    """

    if not ELEVENLABS_API_KEY:
        raise ElevenLabsAPIError(
            "ELEVENLABS_API_KEY is not set. Export it or place it in your .env file."
        )

    effective_prompt = prompt.strip() if prompt else ""
    if style:
        style_snippet = style.strip()
        if style_snippet and style_snippet.lower() not in effective_prompt.lower():
            effective_prompt = f"Style: {style_snippet}. {effective_prompt}".strip()
        elif not effective_prompt:
            effective_prompt = f"Style: {style_snippet}".strip()

    # ElevenLabs expects milliseconds and clamps to the documented range.
    duration_ms = max(10_000, min(300_000, int(duration_seconds * 1000)))

    headers = {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
        "Accept": "audio/mpeg",
    }

    payload = {
        "prompt": effective_prompt or "Instrumental electronic track suitable for events",
        "music_length_ms": duration_ms,
        "model_id": DEFAULT_MODEL_ID,
        "output_format": DEFAULT_OUTPUT_FORMAT,
    }

    timeout = aiohttp.ClientTimeout(total=120)
    async with aiohttp.ClientSession(timeout=timeout) as session:
        async with session.post(
            ELEVENLABS_MUSIC_ENDPOINT,
            headers=headers,
            data=json.dumps(payload),
        ) as response:
            if response.status != 200:
                try:
                    error_payload = await response.json()
                except aiohttp.ContentTypeError:
                    error_payload = {"message": await response.text()}

                message = error_payload.get("message") if isinstance(error_payload, dict) else str(error_payload)
                raise ElevenLabsAPIError(
                    f"ElevenLabs request failed ({response.status}): {message}"
                )

            content = await response.read()
            if not content:
                raise ElevenLabsAPIError("ElevenLabs returned an empty audio payload")

            mime_type = response.headers.get("Content-Type", "audio/mpeg")

    timestamp = int(time.time())
    extension = _guess_extension(mime_type)
    file_name = f"elevenlabs-music-{uuid.uuid4().hex[:8]}-{timestamp}.{extension}"
    file_path = MUSIC_OUTPUT_DIR / file_name

    # Write the audio file synchronously; payload is already in memory.
    file_path.write_bytes(content)

    return {
        "music_file": str(file_path),
        "duration_seconds": duration_ms / 1000.0,
        "mime_type": mime_type,
        "message": None,
    }


async def call_elevenlabs_music(
    prompt: str,
    style: Optional[str] = None,
    duration_seconds: int = 60,
) -> Dict[str, Any]:
    """Public async helper that mirrors :func:`_call_elevenlabs_api`."""

    return await _call_elevenlabs_api(
        prompt=prompt,
        style=style,
        duration_seconds=duration_seconds,
    )


def _guess_extension(mime_type: str) -> str:
    mime = (mime_type or "").lower()
    if "wav" in mime or "x-wav" in mime or "wave" in mime:
        return "wav"
    if "ogg" in mime:
        return "ogg"
    if "flac" in mime:
        return "flac"
    if "aac" in mime:
        return "aac"
    if "m4a" in mime:
        return "m4a"
    if "opus" in mime:
        return "opus"
    return "mp3"


async def _async_main(args: argparse.Namespace) -> int:
    try:
        result = await _call_elevenlabs_api(
            prompt=args.prompt,
            style=args.style,
            duration_seconds=args.duration,
        )
    except ElevenLabsAPIError as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1

    print(json.dumps(result, indent=2))
    return 0


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Generate music using ElevenLabs")
    parser.add_argument("prompt", nargs="?", default="", help="Creative prompt for the track")
    parser.add_argument("--style", default="", help="Target music style (e.g. upbeat, chill)")
    parser.add_argument(
        "--duration",
        type=int,
        default=60,
        help="Desired duration in seconds (defaults to 60; clamped by the API)",
    )
    return parser


def main(argv: Optional[list[str]] = None) -> int:
    parser = _build_parser()
    args = parser.parse_args(argv)
    return asyncio.run(_async_main(args))


if __name__ == "__main__":
    raise SystemExit(main())
