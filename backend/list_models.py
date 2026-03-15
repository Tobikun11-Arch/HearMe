"""
Lists models available to your credentials.

Run from your backend folder:
    python list_models.py

If GOOGLE_CLOUD_PROJECT + GOOGLE_CLOUD_REGION are set, this uses Vertex AI (ADC).
Otherwise it falls back to GEMINI_API_KEY.
"""
import os
from dotenv import load_dotenv
from google import genai

load_dotenv()

gcp_project = os.getenv("GOOGLE_CLOUD_PROJECT", "").strip()
gcp_region = os.getenv("GOOGLE_CLOUD_REGION", "").strip() or os.getenv(
    "GOOGLE_CLOUD_LOCATION", ""
).strip()
api_key = os.getenv("GEMINI_API_KEY", "").strip()

if gcp_project and gcp_region:
    client = genai.Client(vertexai=True, project=gcp_project, location=gcp_region)
    mode = f"Vertex AI (project={gcp_project}, region={gcp_region})"
elif api_key:
    client = genai.Client(api_key=api_key)
    mode = "API key"
else:
    print(
        "ERROR: No credentials found. Set GOOGLE_CLOUD_PROJECT + GOOGLE_CLOUD_REGION (Vertex/ADC) "
        "or GEMINI_API_KEY."
    )
    raise SystemExit(1)

print("=" * 60)
print(f"All models available ({mode})")
print("=" * 60)

live_models = []

for model in client.models.list():
    name = getattr(model, "name", "?")
    display = getattr(model, "display_name", "")
    supported_actions = getattr(model, "supported_generation_methods", [])

    # Check if model supports Live (bidiGenerateContent)
    is_live = any("bidi" in str(a).lower() for a in supported_actions)

    marker = "  *** LIVE CAPABLE ***" if is_live else ""
    display_part = f" ({display})" if display else ""
    print(f"  {name}{display_part}  [{', '.join(str(a) for a in supported_actions)}]{marker}")

    if is_live:
        live_models.append(name)

print()
print("=" * 60)
if live_models:
    print("Live-capable models found:")
    for m in live_models:
        print(f"  {m}")
    print()
    print(f">> Use this in main.py / test_gemini.py:")
    print(f'   model = "{live_models[0]}"')
else:
    print("No Live-capable models detected from this listing output.")
    print()
    print("Possible causes:")
    print("  1. Live models are not available in this region.")
    print("  2. Your project/account doesn't have access to Gemini Live on Vertex yet.")
    print("  3. This client library/version doesn't expose supported_generation_methods for publisher models.")
    print()
    print("To fix:")
    print("  - Try changing GOOGLE_CLOUD_REGION (e.g. us-east1, us-west1) and run again.")
    print("  - In Cloud Console, ensure Vertex AI API is enabled.")