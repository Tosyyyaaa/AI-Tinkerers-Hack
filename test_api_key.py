#!/usr/bin/env python3
"""
Legacy utility that previously verified the OpenWeather API key.
Weather lookups now live inside the Next.js API route
`app/api/weather/route.ts`, so this helper has been retired.
"""

raise RuntimeError(
    "test_api_key.py is obsolete. Configure WEATHERAPI parameters through the "
    "frontend Next.js route instead."
)
