import base64
import hashlib
import hmac
import json
import time

USERS = {
    "nurse@test.com": {
        "email": "nurse@test.com",
        "password": "password123",
        "role": "nurse",
        "name": "Ward Nurse",
    },
    "doctor@test.com": {
        "email": "doctor@test.com",
        "password": "password123",
        "role": "doctor",
        "name": "Duty Doctor",
    },
    "admin@test.com": {
        "email": "admin@test.com",
        "password": "password123",
        "role": "admin",
        "name": "System Admin",
    },
    "patient1@test.com": {
        "email": "patient1@test.com",
        "password": "password123",
        "role": "patient",
        "name": "Patient One",
        "patient_id": 1,
    },
    "patient2@test.com": {
        "email": "patient2@test.com",
        "password": "password123",
        "role": "patient",
        "name": "Patient Two",
        "patient_id": 2,
    },
}


def _b64url_encode(data):
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("utf-8")


def _b64url_decode(data):
    padding = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(f"{data}{padding}".encode("utf-8"))


def authenticate_user(email, password):
    user = USERS.get((email or "").strip().lower())
    if not user or user["password"] != password:
        return None
    return sanitize_user(user)


def sanitize_user(user):
    sanitized = {
        "email": user["email"],
        "role": user["role"],
        "name": user["name"],
    }
    if "patient_id" in user:
        sanitized["patient_id"] = user["patient_id"]
    return sanitized


def create_token(user, secret_key, expires_in=60 * 60 * 8):
    header = {"alg": "HS256", "typ": "JWT"}
    payload = {
        "sub": user["email"],
        "role": user["role"],
        "name": user["name"],
        "exp": int(time.time()) + expires_in,
    }
    if user.get("patient_id") is not None:
        payload["patient_id"] = user["patient_id"]

    encoded_header = _b64url_encode(
        json.dumps(header, separators=(",", ":")).encode("utf-8")
    )
    encoded_payload = _b64url_encode(
        json.dumps(payload, separators=(",", ":")).encode("utf-8")
    )
    signing_input = f"{encoded_header}.{encoded_payload}".encode("utf-8")
    signature = hmac.new(
        secret_key.encode("utf-8"), signing_input, hashlib.sha256
    ).digest()
    encoded_signature = _b64url_encode(signature)
    return f"{encoded_header}.{encoded_payload}.{encoded_signature}"


def verify_token(token, secret_key):
    if not token:
        raise ValueError("missing token")

    parts = token.split(".")
    if len(parts) != 3:
        raise ValueError("invalid token")

    encoded_header, encoded_payload, encoded_signature = parts
    signing_input = f"{encoded_header}.{encoded_payload}".encode("utf-8")
    expected_signature = hmac.new(
        secret_key.encode("utf-8"), signing_input, hashlib.sha256
    ).digest()
    provided_signature = _b64url_decode(encoded_signature)

    if not hmac.compare_digest(expected_signature, provided_signature):
        raise ValueError("invalid signature")

    payload = json.loads(_b64url_decode(encoded_payload).decode("utf-8"))
    if payload.get("exp", 0) < int(time.time()):
        raise ValueError("token expired")

    user = USERS.get(payload.get("sub", "").lower())
    if not user:
        raise ValueError("user not found")

    return sanitize_user(user)
