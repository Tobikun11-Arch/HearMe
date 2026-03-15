"""
Quick Gemini Live diagnostic — run this from your backend folder:
    python test_gemini.py

It will tell you exactly which model + config works.
"""
import asyncio
import os
from dotenv import load_dotenv
from google import genai
from google.genai import types

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

# ── Candidates to try in order ──────────────────────────────────────────────
# For Vertex, this script will auto-discover Gemini publisher models from models.list().
CANDIDATES: list[tuple[str, list[str]]] = []

SYSTEM_PROMPT = (
    "You are a sign language teacher. "
    "Respond only with a JSON object: {\"lesson_text\": \"...\", \"correct\": false, \"reason\": \"...\", \"gesture_id\": \"\"}."
)

async def try_model(model: str, modalities: list[str]) -> bool:
    label = f"model={model!r}  modalities={modalities}"
    try:
        config = types.LiveConnectConfig(
            response_modalities=modalities,
            system_instruction=types.Content(
                parts=[types.Part(text=SYSTEM_PROMPT)]
            ),
        )
        async with client.aio.live.connect(model=model, config=config) as session:
            # Send a tiny text turn to confirm the session actually works
            await session.send_client_content(
                turns=types.Content(role="user", parts=[types.Part(text="Hello")])
            )
            # Read one response chunk
            async for resp in session.receive():
                content = getattr(resp, "server_content", None)
                turn    = getattr(content, "model_turn", None) if content else None
                parts   = getattr(turn, "parts", None) if turn else None
                if parts:
                    text = getattr(parts[0], "text", None)
                    print(f"  ✓  WORKS  {label}")
                    print(f"     Response snippet: {str(text)[:120]}")
                    return True
                # keep reading until we get a text part or turn_complete
                done = getattr(content, "turn_complete", False) if content else False
                if done:
                    print(f"  ✓  WORKS (turn_complete, no text)  {label}")
                    return True
        print(f"  ✓  WORKS (session closed cleanly)  {label}")
        return True
    except Exception as exc:
        print(f"  ✗  FAILED  {label}")
        print(f"     {type(exc).__name__}: {exc}")
        return False


async def main():
    print("=" * 60)
    print(f"Gemini Live — model/config probe ({mode})")
    print("=" * 60)

    discovered: list[str] = []
    try:
        for m in client.models.list():
            name = str(getattr(m, "name", ""))
            if not name:
                continue
            if "gemini" not in name.lower():
                continue
            discovered.append(name)
    except Exception as e:
        print(f"ERROR listing models: {e}")
        return

    if discovered:
        for model_name in discovered:
            CANDIDATES.append((model_name, ["TEXT"]))

    # Manual fallbacks (in case listing doesn't include live aliases)
    CANDIDATES.extend(
        [
            ("publishers/google/models/gemini-2.0-flash-live-001", ["TEXT"]),
            ("gemini-2.0-flash-live-001", ["TEXT"]),
        ]
    )

    seen: set[tuple[str, tuple[str, ...]]] = set()
    filtered: list[tuple[str, list[str]]] = []
    for model, modalities in CANDIDATES:
        key = (model, tuple(modalities))
        if key in seen:
            continue
        seen.add(key)
        filtered.append((model, modalities))

    for model, modalities in filtered:
        worked = await try_model(model, modalities)
        if worked:
            print()
            print(">> Use this in main.py:")
            print(f'   model = "{model}"')
            print(f'   response_modalities = {modalities}')
            return

    print()
    print("None of the candidates worked. Check your API key and project quota.")

asyncio.run(main())