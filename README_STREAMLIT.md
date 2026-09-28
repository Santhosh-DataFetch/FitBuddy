# FitBuddy — Streamlit showcase

This repository contains the original React/Vite/Express FitBuddy application plus a Streamlit deployment surface at `streamlit_app.py`.

## Streamlit Cloud

1. Deploy `streamlit_app.py` from the `main` branch.
2. Open **Settings → Secrets** and add:

```toml
SUPABASE_URL = "https://YOUR_PROJECT.supabase.co"
SUPABASE_PUBLISHABLE_KEY = "YOUR_PUBLISHABLE_KEY"
GEMINI_API_KEY = "YOUR_GEMINI_API_KEY"
GEMINI_WORKOUT_MODEL = "gemini-3.8-flash"
```

Do not commit secrets. The Streamlit surface uses the Supabase publishable key with authenticated user sessions and RLS; it does not require the Supabase service-role key.

## Local run

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
streamlit run streamlit_app.py
```

For local development, environment variables with the same names are also supported.

## AI behavior

The app uses Gemini structured JSON output and validates the generated plan with Pydantic before persistence. The default model is `gemini-3.8-flash`, configurable through `GEMINI_WORKOUT_MODEL`.

The Streamlit surface is a deployment/showcase layer and does not replace the existing React/Node application.
