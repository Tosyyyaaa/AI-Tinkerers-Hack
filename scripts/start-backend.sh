#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ -f "${PROJECT_ROOT}/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "${PROJECT_ROOT}/.env"
  set +a
else
  echo "Warning: .env file not found; starting backend without additional environment variables." >&2
fi

PYTHON_BIN="${PROJECT_ROOT}/venv/bin/python"

if [[ ! -x "${PYTHON_BIN}" ]]; then
  echo "Python virtual environment not found at ${PYTHON_BIN}. Run 'python3 -m venv venv' and install requirements." >&2
  exit 1
fi

exec "${PYTHON_BIN}" "${PROJECT_ROOT}/elevenlabs_agentos.py" "$@"
