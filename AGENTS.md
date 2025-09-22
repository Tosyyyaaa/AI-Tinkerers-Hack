# Repository Guidelines

## Project Structure & Module Organization
The Next.js frontend lives in `app/`, `lib/`, and `components/`. Routes follow the app-router convention (`app/vibe/page.tsx` for UI, `app/api/generate-vibe-music/route.ts` for the AgentOS bridge). Shared motion, audio, and vibe logic sits under `lib/`, while UI primitives stay in `components/`. Python agents and tooling (`elevenlabs_agentos.py`, `mcp_elevenlabs_server.py`, `weather_playground.py`) remain at the repo root alongside executable scripts in `test_*.py`.

## Build, Test, and Development Commands
Run `npm install` once, then use:
- `npm run dev` — launch the frontend on http://localhost:3000/vibe with hot reload
- `npm run build` — generate the production Next.js bundle
- `npm run lint` — enforce the shared ESLint/TypeScript/Tailwind rules
For AgentOS, create a virtualenv (`python -m venv venv && source venv/bin/activate`), install `pip install -r requirements.txt`, and start the server with `python elevenlabs_agentos.py` (serves at http://localhost:7777).

## Coding Style & Naming Conventions
TypeScript files use 2-space indentation, camelCase for functions, and PascalCase for React components. Keep Tailwind classes ordered from layout → color to match existing patterns. Prefer colocated `useX` hooks in `lib/` and treat `app/api/*` handlers as thin orchestrators. Python modules follow PEP 8 with snake_case functions, type hints, and descriptive docstrings—mirror the existing async patterns in `test_integration.py` when adding new tools.

## Testing Guidelines
Run `npm run lint` before submitting UI changes. Python verification relies on the executable scripts: `python test_integration.py` for end-to-end MCP checks, `python test_mcp_server.py` for stdio transport, and `python test_as_agno_agent.py` for AgentOS simulations. Activate the virtualenv first, and export `ELEVENLABS_API_KEY` to exercise real audio; without it the mocks should still pass. Add new test scripts under the root with a `test_` prefix and keep output human-readable.

## Commit & Pull Request Guidelines
Commits use present-tense, imperative subjects (`Fix`, `Add`, `Implement`) with optional emoji prefixes when they clarify scope. Bundle related frontend and backend changes together and keep body lines under 72 characters. Pull requests should describe the vibe scenario covered, list relevant commands run, and link any tracking issue. Include screenshots or short clips for UI changes and paste log snippets when exercising the Python agents so reviewers see the mocked vs live behaviour.

## Environment & Secrets
Store local credentials in `.env.local` (Next.js) and export runtime variables for Python shells. At minimum set `OPENROUTER_API_KEY`; add `ELEVENLABS_API_KEY` to enable real music. Never commit keys—use the provided `.env.local.example` pattern if you need to document new variables.
