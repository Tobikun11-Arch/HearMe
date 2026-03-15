import json
import os
import asyncio
import base64
import time
import logging
import sys
from typing import Any
import math

from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from google import genai
from google.genai import types
from google.genai.types import HttpOptions

load_dotenv()

# ── Logging setup ─────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.DEBUG,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
    datefmt="%H:%M:%S",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler("hearme_backend.log", mode="a", encoding="utf-8"),
    ],
)
log = logging.getLogger("hearme")

app = FastAPI()

frontend_origin = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[frontend_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def read_root() -> dict[str, str]:
    return {"status": "ok"}


def _ws_send(ws: WebSocket, msg_type: str, payload: dict[str, Any]) -> Any:
    return ws.send_text(json.dumps({"type": msg_type, "payload": payload}))


def _lm(payload: dict[str, Any]) -> list[dict[str, float]] | None:
    lms = payload.get("landmarks")
    if not isinstance(lms, list) or len(lms) != 21:
        return None
    out: list[dict[str, float]] = []
    for p in lms:
        if not isinstance(p, dict):
            return None
        x = p.get("x")
        y = p.get("y")
        z = p.get("z", 0.0)
        if not isinstance(x, (int, float)) or not isinstance(y, (int, float)) or not isinstance(z, (int, float)):
            return None
        out.append({"x": float(x), "y": float(y), "z": float(z)})
    return out


def _dist(a: dict[str, float], b: dict[str, float]) -> float:
    return math.sqrt((a["x"] - b["x"]) ** 2 + (a["y"] - b["y"]) ** 2 + (a["z"] - b["z"]) ** 2)


def _angle(a: dict[str, float], b: dict[str, float], c: dict[str, float]) -> float:
    # angle ABC in degrees
    bax = a["x"] - b["x"]
    bay = a["y"] - b["y"]
    baz = a["z"] - b["z"]
    bcx = c["x"] - b["x"]
    bcy = c["y"] - b["y"]
    bcz = c["z"] - b["z"]
    dot = bax * bcx + bay * bcy + baz * bcz
    na = math.sqrt(bax * bax + bay * bay + baz * baz)
    nc = math.sqrt(bcx * bcx + bcy * bcy + bcz * bcz)
    if na == 0.0 or nc == 0.0:
        return 0.0
    cosv = max(-1.0, min(1.0, dot / (na * nc)))
    return math.degrees(math.acos(cosv))


def _finger_extended(lms: list[dict[str, float]], mcp: int, pip: int, dip: int, tip: int) -> bool:
    # Simple heuristic: if the finger is mostly straight (angle at PIP is large)
    ang = _angle(lms[mcp], lms[pip], lms[tip])
    return ang > 160.0


def _evaluate_sign(target_sign_id: str, lms: list[dict[str, float]]) -> dict[str, Any]:
    # NOTE: This is a lightweight v1 rule engine. We can add more rules per sign.
    # Landmarks follow MediaPipe Hands indexing.

    # Normalization scale: wrist to middle MCP
    scale = _dist(lms[0], lms[9])
    if scale <= 0.0:
        scale = 1.0

    # Basic features
    thumb_tip = lms[4]
    index_tip = lms[8]
    middle_tip = lms[12]
    ring_tip = lms[16]
    pinky_tip = lms[20]

    index_ext = _finger_extended(lms, 5, 6, 7, 8)
    middle_ext = _finger_extended(lms, 9, 10, 11, 12)
    ring_ext = _finger_extended(lms, 13, 14, 15, 16)
    pinky_ext = _finger_extended(lms, 17, 18, 19, 20)

    # "hello": open palm (most fingers extended)
    if target_sign_id == "hello":
        extended_count = sum([index_ext, middle_ext, ring_ext, pinky_ext])
        correct = extended_count >= 3
        return {
            "correct": correct,
            "reason": "Open palm" if correct else "Extend your fingers",
            "confidence": 0.7 if correct else 0.4,
        }

    # "thank-you": thumb close to chin/mouth is not detectable without face; use proxy
    # v1 proxy: fingers together (tips clustered)
    if target_sign_id == "thank-you":
        cluster = (
            _dist(index_tip, middle_tip)
            + _dist(middle_tip, ring_tip)
            + _dist(ring_tip, pinky_tip)
        ) / scale
        correct = cluster < 0.45 and index_ext and middle_ext
        return {
            "correct": correct,
            "reason": "Fingers together" if correct else "Bring fingers together",
            "confidence": 0.65 if correct else 0.35,
        }

    # "help": v1 proxy: thumb-index pinch (OK-like) because true help is two-hand
    if target_sign_id == "help":
        pinch = _dist(thumb_tip, index_tip) / scale
        correct = pinch < 0.35
        return {
            "correct": correct,
            "reason": "Pinch detected" if correct else "Bring thumb to index",
            "confidence": 0.6 if correct else 0.3,
        }

    # Subject examples placeholders
    if target_sign_id in {"water", "planet", "experiment", "add", "equal", "number", "past", "country", "leader"}:
        # No strong rules yet: return neutral guidance.
        return {
            "correct": False,
            "reason": "Rules not added yet",
            "confidence": 0.1,
        }

    return {"correct": False, "reason": "Unknown sign", "confidence": 0.0}


def _get_genai_client() -> "genai.Client | None":
    gcp_project = os.getenv("GOOGLE_CLOUD_PROJECT", "").strip()
    gcp_region = (
        os.getenv("GOOGLE_CLOUD_REGION", "").strip()
        or os.getenv("GOOGLE_CLOUD_LOCATION", "").strip()
        or "global"
    )
    if gcp_project:
        try:
            return genai.Client(
                vertexai=True,
                project=gcp_project,
                location=gcp_region,
                http_options=HttpOptions(api_version="v1beta1"),
            )
        except Exception:
            pass

    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if api_key:
        return genai.Client(api_key=api_key)

    return None


def _build_system_prompt(session_config: "dict[str, Any] | None") -> str:
    learn_path = str((session_config or {}).get("learnPath", "basic"))
    subject = str((session_config or {}).get("subject", "Basic Sign Language"))
    language = str((session_config or {}).get("spokenLanguage", "en"))
    target_sign_id = str((session_config or {}).get("targetSignId", "")).strip()
    target_sign_label = str((session_config or {}).get("targetSignLabel", "")).strip()
    return (
        "You are a sign language lesson assistant. "
        "You do NOT receive a live video stream for evaluation. "
        "Your job is to generate short, helpful lesson captions and answer user questions about signs. "
        "When you respond, output a single JSON object — no markdown, no extra text — with these keys:\n"
        '  "lesson_text": short instruction or encouragement (string),\n'
        '  "gesture_id": the sign id being discussed (string).\n'
        "Keep responses concise.\n"
        f"Context: learnPath={learn_path}, subject={subject}, spokenLanguage={language}, "
        f"targetSignId={target_sign_id}, targetSignLabel={target_sign_label}."
    )


def _try_parse_json(text: str) -> "dict[str, Any] | None":
    s = text.strip()
    if not s:
        return None
    if s.startswith("```"):
        lines = s.splitlines()
        s = "\n".join(
            line for line in lines if not line.strip().startswith("```")
        ).strip()
    try:
        return json.loads(s)
    except Exception:
        pass
    start = s.find("{")
    end = s.rfind("}")
    if start != -1 and end != -1 and end > start:
        try:
            return json.loads(s[start : end + 1])
        except Exception:
            pass
    return None


async def _close_live_session(
    live_session_cm: Any,
    receiver_task: "asyncio.Task[None] | None",
    sender_task: "asyncio.Task[None] | None" = None,
) -> None:
    for task in (receiver_task, sender_task):
        if task is not None:
            task.cancel()
            try:
                await asyncio.wait_for(asyncio.shield(task), timeout=2.0)
            except Exception:
                pass

    if live_session_cm is not None:
        try:
            await live_session_cm.__aexit__(None, None, None)
        except Exception:
            pass


async def _open_live_session(
    client: Any,
    model: str,
    session_config: "dict[str, Any] | None",
    ws: WebSocket,
    frame_queue: "asyncio.Queue[bytes | None]",
) -> "tuple[Any, Any, asyncio.Task[None], asyncio.Task[None]] | tuple[None, None, None, None]":
    """
    Open Gemini Live session with two concurrent tasks:
    - _recv: reads responses from Gemini and forwards to frontend
    - _sender: drains the frame_queue and streams frames+prompts to Gemini
    """
    system_instruction = types.Content(
        parts=[types.Part(text=_build_system_prompt(session_config))]
    )
    config_obj = types.LiveConnectConfig(
        response_modalities=["TEXT"],
        system_instruction=system_instruction,
    )

    try:
        live_session_cm = client.aio.live.connect(model=model, config=config_obj)
        live_session = await live_session_cm.__aenter__()
        log.info("Gemini Live session opened  model=%s", model)
    except Exception as e:
        log.error("Gemini Live connect error  error=%s", e)
        await _ws_send(ws, "error", {"message": f"Gemini Live connect error: {e}"})
        return None, None, None, None

    # ── Receiver: streams Gemini output → frontend ──────────────────────────
    async def _recv() -> None:
        text_buffer = ""
        turn_count = 0
        try:
            async for response in live_session.receive():
                content = getattr(response, "server_content", None)
                turn_complete = getattr(content, "turn_complete", False)
                interrupted = getattr(content, "interrupted", False)
                model_turn = getattr(content, "model_turn", None) if content else None
                parts = getattr(model_turn, "parts", None) if model_turn else None

                if interrupted:
                    # Gemini interrupted mid-turn — discard buffer, start fresh
                    log.debug("Gemini turn interrupted — discarding buffer")
                    text_buffer = ""
                    continue

                if parts:
                    for part in parts:
                        text = getattr(part, "text", None)
                        if text:
                            log.debug("Gemini chunk  len=%d  preview=%r", len(text), str(text)[:80])
                            text_buffer += str(text)

                if turn_complete and text_buffer:
                    turn_count += 1
                    buffered = text_buffer
                    text_buffer = ""
                    log.info(
                        "Turn #%d complete  buf_len=%d  raw=%r",
                        turn_count, len(buffered), buffered[:300],
                    )

                    parsed = _try_parse_json(buffered)
                    if parsed:
                        log.info(
                            "JSON ok  correct=%s  reason=%r",
                            parsed.get("correct"), parsed.get("reason"),
                        )
                        lesson_text = str(parsed.get("lesson_text", "")).strip()
                        if lesson_text:
                            await _ws_send(ws, "lesson.text", {
                                "text": lesson_text,
                                "language": (session_config or {}).get("spokenLanguage", "en"),
                            })
                        gesture_id = str(parsed.get("gesture_id", "")).strip()
                        if gesture_id:
                            await _ws_send(ws, "avatar.gesture", {
                                "gestureId": gesture_id, "speed": "normal"
                            })

                    else:
                        log.warning("Could not parse JSON  raw=%r", buffered[:300])

                elif turn_complete:
                    log.debug("Turn complete but buffer empty")

        except asyncio.CancelledError:
            log.info("_recv cancelled")
        except Exception as e:
            log.error("_recv error  error=%s", e, exc_info=True)
            try:
                await _ws_send(ws, "error", {"message": f"Gemini receive error: {e}"})
            except Exception:
                pass

    # ── Sender: drains frame_queue → Gemini (non-blocking) ──────────────────
    # KEY CHANGE: frames are sent as pure realtime_input without waiting for a
    # response each time. Gemini Live will naturally produce output as it processes
    # the stream. We only send a text prompt once every N frames to trigger eval.
    PROMPT_EVERY_N_FRAMES = int(os.getenv("PROMPT_EVERY_N_FRAMES", "3"))

    async def _sender() -> None:
        frame_count = 0
        target_label = str((session_config or {}).get("targetSignLabel", "")).strip()
        target_text = f"Target sign: {target_label}. " if target_label else ""
        eval_prompt = (
            f"{target_text}Evaluate now. JSON only."
        )
        try:
            while True:
                frame_bytes = await frame_queue.get()
                if frame_bytes is None:
                    log.info("_sender received stop signal")
                    break

                frame_count += 1
                try:
                    # Always stream the video frame
                    await live_session.send_realtime_input(
                        video=types.Blob(data=frame_bytes, mime_type="image/jpeg")
                    )
                    log.debug("Frame #%d streamed  size=%d", frame_count, len(frame_bytes))

                    # Only attach a text prompt every N frames to request evaluation
                    # This avoids flooding Gemini with prompts and lets it evaluate naturally
                    if frame_count % PROMPT_EVERY_N_FRAMES == 0:
                        await live_session.send_client_content(
                            turns=[types.Content(
                                role="user",
                                parts=[types.Part(text=eval_prompt)],
                            )],
                            turn_complete=True,
                        )
                        log.debug("Eval prompt sent at frame #%d", frame_count)

                except Exception as e:
                    log.error("_sender send error  frame=%d  error=%s", frame_count, e)
                    try:
                        await _ws_send(ws, "error", {"message": f"Gemini send error: {e}"})
                    except Exception:
                        pass

        except asyncio.CancelledError:
            log.info("_sender cancelled")

    receiver_task: asyncio.Task[None] = asyncio.create_task(_recv())
    sender_task: asyncio.Task[None] = asyncio.create_task(_sender())
    return live_session_cm, live_session, receiver_task, sender_task


@app.websocket("/stream")
async def stream(ws: WebSocket):
    client_id = f"{ws.client.host}:{ws.client.port}" if ws.client else "unknown"
    await ws.accept()
    log.info("WS connected  client=%s", client_id)

    session_started = False
    session_config: "dict[str, Any] | None" = None

    client = _get_genai_client()
    model = os.getenv("GEMINI_LIVE_MODEL", "gemini-2.0-flash-live-preview-04-09")

    live_session_cm: Any = None
    live_session: Any = None
    receiver_task: "asyncio.Task[None] | None" = None
    sender_task: "asyncio.Task[None] | None" = None

    # Shared queue: frontend frames → _sender task
    # maxsize=2 so we always process the LATEST frame, not stale ones
    frame_queue: asyncio.Queue[bytes | None] = asyncio.Queue(maxsize=2)

    # Frontend sends frames every 500ms; we throttle here too as a safety net
    FRAME_INTERVAL = float(os.getenv("FRAME_INTERVAL_SECONDS", "0.4"))
    last_frame_sent_at: float = 0.0

    gemini_enabled = client is not None
    log.info("Gemini client init  enabled=%s", gemini_enabled)

    gcp_project = os.getenv("GOOGLE_CLOUD_PROJECT", "").strip()
    gcp_region = (
        os.getenv("GOOGLE_CLOUD_REGION", "").strip()
        or os.getenv("GOOGLE_CLOUD_LOCATION", "").strip()
        or "global"
    )
    api_key_present = bool(os.getenv("GEMINI_API_KEY", "").strip())

    if gemini_enabled and gcp_project:
        gemini_reason = (
            f"Vertex AI via ADC (project={gcp_project}, region={gcp_region}), "
            f"model={model}, api=v1beta1"
        )
    elif gemini_enabled and api_key_present:
        gemini_reason = f"API key, model={model}"
    else:
        gemini_reason = "No credentials found."

    await _ws_send(ws, "status", {
        "backend": "fastapi",
        "geminiLive": {"enabled": gemini_enabled, "reason": gemini_reason},
    })

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

            # ── session.start ────────────────────────────────────────────────
            if msg_type == "session.start":
                new_target = str(payload.get("targetSignId", "")).strip()
                old_target = str((session_config or {}).get("targetSignId", "")).strip()
                config_changed = (not session_started) or (new_target != old_target)

                log.info(
                    "session.start  target=%s  old=%s  changed=%s",
                    new_target, old_target, config_changed,
                )

                session_started = True
                session_config = payload

                if gemini_enabled and config_changed:
                    if live_session_cm is not None:
                        log.info("Tearing down old Gemini session")
                        # Signal sender to stop
                        try:
                            frame_queue.put_nowait(None)
                        except asyncio.QueueFull:
                            pass
                        await _close_live_session(live_session_cm, receiver_task, sender_task)
                        live_session_cm = None
                        live_session = None
                        receiver_task = None
                        sender_task = None
                        # Fresh queue for new session
                        frame_queue = asyncio.Queue(maxsize=2)

                    log.info("Opening Gemini Live session  model=%s", model)
                    live_session_cm, live_session, receiver_task, sender_task = (
                        await _open_live_session(client, model, session_config, ws, frame_queue)
                    )
                    if live_session is None:
                        log.error("Failed to open Gemini session")
                    else:
                        log.info("Gemini session ready")

                await _ws_send(ws, "session.ready", {"sessionId": "local-dev"})
                await _ws_send(ws, "lesson.text", {
                    "text": "Session ready. Show your hands!",
                    "language": payload.get("spokenLanguage", "en"),
                })
                continue

            if not session_started:
                await _ws_send(ws, "error", {"message": "Send session.start first"})
                continue

            # ── input.landmarks (fast path) ──────────────────────────────────
            if msg_type == "input.landmarks":
                lms = _lm(payload)
                if lms is None:
                    continue
                target_id = str((session_config or {}).get("targetSignId", "")).strip()
                result = _evaluate_sign(target_id, lms)
                await _ws_send(ws, "practice.feedback", {
                    "correct": bool(result.get("correct", False)),
                    "reason": str(result.get("reason", "")).strip(),
                    "confidence": float(result.get("confidence", 0.0)),
                })
                continue

            # ── input.frame (legacy; ignored) ────────────────────────────────
            if msg_type == "input.frame":
                # Frames are intentionally not used in landmark mode.
                continue

            # ── input.audio (removed from product; ignore) ───────────────────
            if msg_type == "input.audio":
                continue

            # ── input.question ───────────────────────────────────────────────
            if msg_type == "input.question":
                text = str(payload.get("text", "")).strip()
                if gemini_enabled and live_session is not None and text:
                    try:
                        await live_session.send_client_content(
                            turns=[types.Content(
                                role="user", parts=[types.Part(text=text)]
                            )],
                            turn_complete=True,
                        )
                        log.info("Question sent  text=%r", text[:100])
                    except Exception as e:
                        log.error("Question send error  error=%s", e)
                        await _ws_send(ws, "error", {"message": f"Question send error: {e}"})
                else:
                    await _ws_send(ws, "lesson.text", {
                        "text": f"Question received: {text}" if text else "No question.",
                        "language": (session_config or {}).get("spokenLanguage", "en"),
                    })
                continue

            await _ws_send(ws, "error", {"message": f"Unknown event: {msg_type}"})

    except WebSocketDisconnect:
        log.info("WS disconnected  client=%s", client_id)
    except Exception as e:
        log.error("WS stream error  error=%s", e, exc_info=True)
    finally:
        log.info("Cleaning up  client=%s", client_id)
        try:
            frame_queue.put_nowait(None)
        except Exception:
            pass
        await _close_live_session(live_session_cm, receiver_task, sender_task)