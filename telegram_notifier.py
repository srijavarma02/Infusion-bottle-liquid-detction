import importlib
import requests

import config

_token = ""
_chat_id = ""


def load_config():
    global _token, _chat_id
    importlib.reload(config)
    _token = getattr(config, "TELEGRAM_BOT_TOKEN", "")
    _chat_id = getattr(config, "TELEGRAM_CHAT_ID", "")


def set_config(token, chat_id):
    global _token, _chat_id
    _token = token or ""
    _chat_id = chat_id or ""


def is_configured():
    return bool(_token and _chat_id)


def send_notification(message):
    if not is_configured():
        return False
    try:
        url = f"https://api.telegram.org/bot{_token}/sendMessage"
        response = requests.post(
            url,
            data={"chat_id": _chat_id, "text": message},
            timeout=5,
        )
        return response.ok
    except Exception as exc:
        print(f"[Telegram] Error: {exc}")
        return False


load_config()
