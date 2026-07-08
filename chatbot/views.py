import json
import logging

import requests
from django.conf import settings
from django.http import JsonResponse
from django.shortcuts import render
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET, require_POST

from .knowledge_base import SYSTEM_PROMPT, QUICK_REPLIES
from .models import ChatSession, ChatMessage

logger = logging.getLogger(__name__)

MAX_HISTORY_MESSAGES = 12  # how many past turns to send back to Mistral for context


def widget_demo(request):
    """Renders a demo page with the chat widget embedded, for local testing."""
    return render(request, "chatbot/demo.html")


@require_GET
def quick_replies(request):
    """Returns the quick-reply cards shown under the first bot message."""
    return JsonResponse({"quick_replies": QUICK_REPLIES})


@csrf_exempt
@require_POST
def clear_chat(request):
    """
    Deletes all messages for a session (and the session row itself) so the
    conversation starts fresh. Expects JSON: { "session_id": "uuid" }
    Returns JSON: { "status": "cleared" }
    """
    try:
        payload = json.loads(request.body or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON body."}, status=400)

    session_id = payload.get("session_id")
    if session_id:
        ChatSession.objects.filter(session_id=session_id).delete()

    return JsonResponse({"status": "cleared"})


@csrf_exempt
@require_POST
def chat_api(request):
    """
    Main chat endpoint.
    Expects JSON: { "message": "...", "session_id": "optional-uuid" }
    Returns JSON: { "reply": "...", "session_id": "uuid" }
    """
    try:
        payload = json.loads(request.body or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON body."}, status=400)

    user_message = (payload.get("message") or "").strip()
    session_id = payload.get("session_id")

    if not user_message:
        return JsonResponse({"error": "Message cannot be empty."}, status=400)

    # --- get or create session ---
    session = None
    if session_id:
        session = ChatSession.objects.filter(session_id=session_id).first()
    if session is None:
        session = ChatSession.objects.create()

    ChatMessage.objects.create(session=session, role="user", content=user_message)

    # --- build conversation history for Mistral ---
    history_qs = session.messages.order_by("-created_at")[:MAX_HISTORY_MESSAGES]
    history = list(reversed(history_qs))

    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    for msg in history:
        role = "assistant" if msg.role == "assistant" else "user"
        messages.append({"role": role, "content": msg.content})

    reply_text = call_mistral(messages)

    ChatMessage.objects.create(session=session, role="assistant", content=reply_text)

    return JsonResponse({
        "reply": reply_text,
        "session_id": str(session.session_id),
    })


def call_mistral(messages):
    """Calls the Mistral AI chat completions API and returns the reply text."""
    if not settings.MISTRAL_API_KEY:
        return (
            "MahaAI isn't fully connected yet — the site admin needs to set the "
            "MISTRAL_API_KEY environment variable on the server. "
            "Meanwhile, you can reach the Mahashankh team on WhatsApp at "
            "+91 6203495282."
        )

    headers = {
        "Authorization": f"Bearer {settings.MISTRAL_API_KEY}",
        "Content-Type": "application/json",
    }
    body = {
        "model": settings.MISTRAL_MODEL,
        "messages": messages,
        "temperature": 0.4,
        "max_tokens": 500,
    }

    try:
        response = requests.post(
            settings.MISTRAL_API_URL, headers=headers, json=body, timeout=30
        )
        response.raise_for_status()
        data = response.json()
        return data["choices"][0]["message"]["content"].strip()
    except requests.exceptions.RequestException as exc:
        logger.exception("Mistral API request failed")
        return (
            "Sorry, I'm having trouble connecting right now. Please try again in "
            "a moment, or reach us directly on WhatsApp at +91 6203495282."
        )
    except (KeyError, IndexError, ValueError):
        logger.exception("Unexpected Mistral API response format")
        return "Sorry, something went wrong while processing that. Please try again."