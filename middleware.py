from functools import wraps

from flask import current_app, g, jsonify, request

from auth import verify_token


def _extract_bearer_token():
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        return auth_header.split(" ", 1)[1].strip()
    return request.args.get("access_token")


def require_auth(view_func):
    @wraps(view_func)
    def wrapped(*args, **kwargs):
        token = _extract_bearer_token()
        if not token:
            return jsonify({"error": "authorization required"}), 401

        try:
            user = verify_token(token, current_app.config["SECRET_KEY"])
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 401

        g.current_user = user
        return view_func(*args, **kwargs)

    return wrapped


def require_roles(*roles):
    def decorator(view_func):
        @require_auth
        @wraps(view_func)
        def wrapped(*args, **kwargs):
            user = getattr(g, "current_user", None)
            if not user or user.get("role") not in roles:
                return jsonify({"error": "forbidden"}), 403
            return view_func(*args, **kwargs)

        return wrapped

    return decorator
