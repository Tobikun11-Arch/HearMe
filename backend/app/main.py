import json
import os
import asyncio
import base64
import time
from typing import Any

from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from google import genai
from google.genai import types

load_dotenv()

app = FastAPI()

frontend_origin = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[frontend_origin],
    allow_credentials=True,
    allow_methods=["*"] ,
    allow_headers=["*"],
)


@app.get("/")
def read_root() -> dict[str, str]:
    return {"status": "ok"}


def _ws_send(ws: WebSocket, msg_type: str, payload: dict[str, Any]) -> Any:
    return ws.send_text(json.dumps({"type": msg_type, "payload": payload}))


def _gemini_live_enabled() -> tuple[bool, str]:
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        return False, "GEMINI_API_KEY is not set; backend is running in stub mode"
    return True, "GEMINI_API_KEY detected; Gemini Live bridge not yet implemented in this build"


def _get_genai_client() -> genai.Client | None:
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        return None
    return genai.Client(api_key=api_key)


def _build_system_prompt(session_config: dict[str, Any] | None) -> str:
    learn_path = str((session_config or {}).get("learnPath", "basic"))
    subject = str((session_config or {}).get("subject", "Basic Sign Language"))
    language = str((session_config or {}).get("spokenLanguage", "en"))
    target_sign_id = str((session_config or {}).get("targetSignId", "")).strip()
    target_sign_label = str((session_config or {}).get("targetSignLabel", "")).strip()
    return (
        "You are a sign language teacher and evaluator. "
        "The user will send webcam frames containing their signing and may send microphone audio. "
        "Respond only with a single JSON object on each turn, with keys: "
        "lesson_text (string), correct (boolean), reason (string), gesture_id (string). "
        "Keep reason short. If you cannot see hands clearly, set correct=false and reason='No sign detected'. "
        f"Context: learnPath={learn_path}, subject={subject}, spokenLanguage={language}, "
        f"targetSignId={target_sign_id}, targetSignLabel={target_sign_label}. "
        "Evaluate correctness specifically against the target sign."
    )


def _try_parse_json(text: str) -> dict[str, Any] | None:
    s = text.strip()
    if not s:
        return None
    try:
        return json.loads(s)
    except Exception:
        return None


@app.websocket("/stream")
async def stream(ws: WebSocket):
    await ws.accept()

    session_started = False
    session_config: dict[str, Any] | None = None

    client = _get_genai_client()
    model = os.getenv("GEMINI_LIVE_MODEL", "gemini-2.5-flash-native-audio-preview-12-2025")
    live_session: Any | None = None
    receiver_task: asyncio.Task[None] | None = None
    last_video_forwarded_at: float = 0.0

    gemini_enabled = client is not None
    gemini_reason = (
        "GEMINI_API_KEY detected; Gemini Live bridge enabled"
        if gemini_enabled
        else "GEMINI_API_KEY is not set; backend is running in stub mode"
    )
    await _ws_send(
        ws,
        "status",
        {
            "backend": "fastapi",
            "geminiLive": {"enabled": gemini_enabled, "reason": gemini_reason},
        },
    )

    try:
        while True:
            raw = await ws.receive_text()
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                await _ws_send(ws, "error", {"message": "Invalid JSON"})
                continue

            msg_type = msg.get("type")
            payload = msg.get("payload") or {}

            if msg_type == "session.start":
                session_started = True
                session_config = payload

                if gemini_enabled and live_session is None:
                    config = types.LiveConnectConfig(
                        response_modalities=["TEXT"],
                        system_instruction=_build_system_prompt(session_config),
                    )
                    live_session = await client.aio.live.connect(model=model, config=config)

                    async def _recv() -> None:
                        try:
                            async for response in live_session.receive():
                                content = getattr(response, "server_content", None)
                                model_turn = getattr(content, "model_turn", None) if content else None
                                parts = getattr(model_turn, "parts", None) if model_turn else None
                                if not parts:
                                    continue
                                for part in parts:
                                    text = getattr(part, "text", None)
                                    if not text:
                                        continue
                                    parsed = _try_parse_json(str(text))
                                    if parsed:
                                        lesson_text = str(parsed.get("lesson_text", "")).strip()
                                        if lesson_text:
                                            await _ws_send(
                                                ws,
                                                "lesson.text",
                                                {
                                                    "text": lesson_text,
                                                    "language": (session_config or {}).get(
                                                        "spokenLanguage", "en"
                                                    ),
                                                },
                                            )
                                        if "correct" in parsed or "reason" in parsed:
                                            await _ws_send(
                                                ws,
                                                "practice.feedback",
                                                {
                                                    "correct": bool(parsed.get("correct", False)),
                                                    "reason": str(parsed.get("reason", "")).strip(),
                                                },
                                            )
                                        gesture_id = str(parsed.get("gesture_id", "")).strip()
                                        if gesture_id:
                                            await _ws_send(
                                                ws,
                                                "avatar.gesture",
                                                {"gestureId": gesture_id, "speed": "normal"},
                                            )
                                    else:
                                        await _ws_send(
                                            ws,
                                            "lesson.text",
                                            {
                                                "text": str(text),
                                                "language": (session_config or {}).get(
                                                    "spokenLanguage", "en"
                                                ),
                                            },
                                        )
                        except Exception as e:
                            await _ws_send(ws, "error", {"message": f"Gemini receive error: {e}"})

                    receiver_task = asyncio.create_task(_recv())

                await _ws_send(ws, "session.ready", {"sessionId": "local-dev"})
                await _ws_send(
                    ws,
                    "lesson.text",
                    {
                        "text": "Session ready. Camera streaming is enabled.",
                        "language": payload.get("spokenLanguage", "en"),
                    },
                )
                continue

            if not session_started:
                await _ws_send(ws, "error", {"message": "Send session.start first"})
                continue

            if msg_type == "input.frame":
                if gemini_enabled and live_session is not None:
                    now = time.monotonic()
                    if now - last_video_forwarded_at < 1.0:
                        continue
                    last_video_forwarded_at = now

                    mime = str(payload.get("mime", "image/jpeg"))
                    data_b64 = str(payload.get("data", ""))
                    if not data_b64:
                        continue
                    try:
                        frame_bytes = base64.b64decode(data_b64)
                    except Exception:
                        await _ws_send(ws, "error", {"message": "Invalid base64 frame"})
                        continue
                    await live_session.send_realtime_input(
                        video=types.Blob(data=frame_bytes, mime_type=mime)
                    )
                else:
                    subject = (session_config or {}).get("subject", "Basic Sign Language")
                    target = str((session_config or {}).get("targetSignLabel", "")).strip()
                    target_text = f" Target: {target}." if target else ""
                    await _ws_send(
                        ws,
                        "lesson.text",
                        {
                            "text": f"Received frame. Subject: {subject}.{target_text}",
                            "language": (session_config or {}).get("spokenLanguage", "en"),
                        },
                    )
                    await _ws_send(
                        ws,
                        "practice.feedback",
                        {
                            "correct": False,
                            "reason": "No sign detected (Gemini Live disabled).",
                        },
                    )
                continue

            if msg_type == "input.audio":
                if gemini_enabled and live_session is not None:
                    mime = str(payload.get("mime", "audio/pcm;rate=16000"))
                    data_b64 = str(payload.get("data", ""))
                    if not data_b64:
                        continue
                    try:
                        audio_bytes = base64.b64decode(data_b64)
                    except Exception:
                        await _ws_send(ws, "error", {"message": "Invalid base64 audio"})
                        continue
                    await live_session.send_realtime_input(
                        audio=types.Blob(data=audio_bytes, mime_type=mime)
                    )
                continue

            if msg_type == "input.video":
                await _ws_send(
                    ws,
                    "lesson.text",
                    {
                        "text": "Video input received (stub). Use frames for now.",
                        "language": (session_config or {}).get("spokenLanguage", "en"),
                    },
                )
                continue

            if msg_type == "input.question":
                text = str(payload.get("text", "")).strip()
                await _ws_send(
                    ws,
                    "lesson.text",
                    {
                        "text": f"Question received (stub): {text}" if text else "Question received (stub).",
                        "language": (session_config or {}).get("spokenLanguage", "en"),
                    },
                )
                continue

            await _ws_send(ws, "error", {"message": f"Unknown event type: {msg_type}"})
    except WebSocketDisconnect:
        if receiver_task:
            receiver_task.cancel()
        if live_session is not None:
            try:
                await live_session.close()
            except Exception:
                pass
        return