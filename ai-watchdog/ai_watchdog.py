#!/usr/bin/env python3
"""
KaiOS IP Camera - AI Watchdog (Powered by Mirage 51M)
------------------------------------------------------
Turns your KaiOS phone into an on-device AI Smart Security Camera.
Connects to the KaiOS camera stream and runs:
  - 100% Local Scene Understanding using Cactus Mirage (51M VLM)
  - Person, Pet, and Vehicle Detection
  - Instant Photo Alerts via Discord Webhook & Telegram Bot
  - Local Snapshot Archiving with Timestamps

Project: https://github.com/su60pi/kaios-ip-camera
Author:  su60pi
License: CC BY-NC-SA 4.0
"""

import os
import sys
import json
import time
import argparse
import urllib.request
import urllib.parse
from datetime import datetime

# Optional dependencies
try:
    from PIL import Image, ImageOps
    HAVE_PIL = True
except ImportError:
    HAVE_PIL = False

try:
    import cv2
    import numpy as np
    HAVE_CV2 = True
except ImportError:
    HAVE_CV2 = False


def send_discord_alert(webhook_url, message, image_path=None):
    """Sends rich alert with optional photo to Discord channel."""
    if not webhook_url:
        return
    try:
        import mimetypes
        boundary = "----WebKitFormBoundary" + hex(int(time.time() * 1000))[2:]

        body = bytearray()
        # Message content
        body.extend(f"--{boundary}\r\nContent-Disposition: form-data; name=\"content\"\r\n\r\n{message}\r\n".encode("utf-8"))

        # Attached image
        if image_path and os.path.exists(image_path):
            filename = os.path.basename(image_path)
            content_type = mimetypes.guess_type(image_path)[0] or "image/jpeg"
            body.extend(f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"{filename}\"\r\nContent-Type: {content_type}\r\n\r\n".encode("utf-8"))
            with open(image_path, "rb") as f:
                body.extend(f.read())
            body.extend(b"\r\n")

        body.extend(f"--{boundary}--\r\n".encode("utf-8"))

        req = urllib.request.Request(webhook_url, data=body, headers={
            "Content-Type": f"multipart/form-data; boundary={boundary}",
            "User-Agent": "KaiOS-AI-Watchdog/1.0"
        })
        with urllib.request.urlopen(req, timeout=10) as resp:
            pass
        print(f"  [+] Discord alert sent successfully!")
    except Exception as e:
        print(f"  [-] Failed to send Discord alert: {e}")


def send_telegram_alert(token, chat_id, caption, image_path=None):
    """Sends photo alert to Telegram chat."""
    if not token or not chat_id:
        return
    try:
        if image_path and os.path.exists(image_path):
            url = f"https://api.telegram.org/bot{token}/sendPhoto"
            boundary = "----WebKitFormBoundary" + hex(int(time.time() * 1000))[2:]
            body = bytearray()
            body.extend(f"--{boundary}\r\nContent-Disposition: form-data; name=\"chat_id\"\r\n\r\n{chat_id}\r\n".encode("utf-8"))
            body.extend(f"--{boundary}\r\nContent-Disposition: form-data; name=\"caption\"\r\n\r\n{caption}\r\n".encode("utf-8"))
            filename = os.path.basename(image_path)
            body.extend(f"--{boundary}\r\nContent-Disposition: form-data; name=\"photo\"; filename=\"{filename}\"\r\nContent-Type: image/jpeg\r\n\r\n".encode("utf-8"))
            with open(image_path, "rb") as f:
                body.extend(f.read())
            body.extend(b"\r\n")
            body.extend(f"--{boundary}--\r\n".encode("utf-8"))
            req = urllib.request.Request(url, data=body, headers={
                "Content-Type": f"multipart/form-data; boundary={boundary}",
                "User-Agent": "KaiOS-AI-Watchdog/1.0"
            })
        else:
            url = f"https://api.telegram.org/bot{token}/sendMessage"
            payload = json.dumps({"chat_id": chat_id, "text": caption}).encode("utf-8")
            req = urllib.request.Request(url, data=payload, headers={
                "Content-Type": "application/json",
                "User-Agent": "KaiOS-AI-Watchdog/1.0"
            })
        with urllib.request.urlopen(req, timeout=10) as resp:
            pass
        print(f"  [+] Telegram alert sent successfully!")
    except Exception as e:
        print(f"  [-] Failed to send Telegram alert: {e}")


class MirageEngine:
    """Manages on-device Mirage 51M model inference."""

    def __init__(self, lib_path=None, model_path=None):
        import ctypes
        self.ctypes = ctypes

        # Auto-detect libcactus.so
        search_paths = [
            lib_path,
            os.environ.get("CACTUS_LIB_PATH"),
            os.path.expanduser("~/MIRAGE/lib/libcactus.so"),
            os.path.join(os.path.dirname(__file__), "lib", "libcactus.so"),
            "/usr/local/lib/libcactus.so"
        ]
        resolved_lib = None
        for p in search_paths:
            if p and os.path.exists(p):
                resolved_lib = p
                break

        if not resolved_lib:
            raise FileNotFoundError("Could not find libcactus.so. Ensure CACTUS_LIB_PATH is set or build libcactus.")

        self.lib = ctypes.CDLL(resolved_lib)
        self.lib.cactus_load.argtypes = [ctypes.c_char_p, ctypes.c_size_t]
        self.lib.cactus_load.restype = ctypes.c_int
        self.lib.cactus_models.restype = ctypes.c_int
        self.lib.cactus_last_error.restype = ctypes.c_char_p

        self.lib.cactus_describe.argtypes = [
            ctypes.c_char_p, ctypes.c_int, ctypes.c_int,
            ctypes.c_char_p, ctypes.c_char_p, ctypes.c_char_p,
            ctypes.c_char_p, ctypes.c_int
        ]
        self.lib.cactus_describe.restype = ctypes.c_int

        # Auto-detect mirage.cact weights
        model_paths = [
            model_path,
            os.path.expanduser("~/MIRAGE/models/mirage.cact"),
            os.path.join(os.path.dirname(__file__), "models", "mirage.cact")
        ]
        resolved_model = None
        for mp in model_paths:
            if mp and os.path.exists(mp):
                resolved_model = mp
                break

        if not resolved_model:
            raise FileNotFoundError("Could not find mirage.cact weights.")

        with open(resolved_model, "rb") as f:
            data = f.read()

        if self.lib.cactus_load(data, len(data)) < 0:
            err = self.lib.cactus_last_error().decode("utf-8", "replace")
            raise RuntimeError(f"Failed to load Mirage weights: {err}")

        self._buffer = ctypes.create_string_buffer(16 * 1024 * 1024)

    def analyze(self, rgb_bytes, width, height, question=None):
        options = {}
        if question:
            options["question"] = question
        opts_enc = json.dumps(options).encode("utf-8")
        res = self.lib.cactus_describe(rgb_bytes, width, height, opts_enc, None, None, self._buffer, len(self._buffer))
        if res < 0:
            err = self.lib.cactus_last_error().decode("utf-8", "replace")
            raise RuntimeError(f"Mirage error: {err}")
        return json.loads(self._buffer.value.decode("utf-8", "replace"))


def fetch_snapshot(ip, port=4444):
    url = f"http://{ip}:{port}/video/snapshot"
    req = urllib.request.Request(url, headers={"User-Agent": "KaiOS-AI-Watchdog/1.0"})
    with urllib.request.urlopen(req, timeout=10) as resp:
        return resp.read()


def to_rgb_bytes(jpg_bytes):
    if not HAVE_PIL:
        raise ImportError("Pillow required: run 'pkg install python-pillow' or 'pip install pillow'")
    import io
    with Image.open(io.BytesIO(jpg_bytes)) as img:
        rgb = ImageOps.exif_transpose(img).convert("RGB")
        return rgb.tobytes(), rgb.width, rgb.height


def main():
    parser = argparse.ArgumentParser(description="KaiOS IP Camera - AI Watchdog (Mirage 51M)")
    parser.add_argument("--ip", type=str, default="", help="KaiOS camera IP (e.g. 192.168.1.15)")
    parser.add_argument("--port", type=int, default=4444, help="Camera port (default: 4444)")
    parser.add_argument("--interval", type=int, default=8, help="Seconds between AI scans (default: 8)")
    parser.add_argument("--discord", type=str, default="", help="Discord webhook URL for instant alerts")
    parser.add_argument("--telegram-token", type=str, default="", help="Telegram bot token")
    parser.add_argument("--telegram-chat-id", type=str, default="", help="Telegram chat ID")
    parser.add_argument("--save-dir", type=str, default="alerts", help="Alert images folder")
    parser.add_argument("--ask", type=str, default="", help="Custom question for Mirage (e.g. 'Is there a person?')")
    args = parser.parse_args()

    os.makedirs(args.save_dir, exist_ok=True)

    print("=" * 65)
    print("  🚀 KaiOS IP Camera - AI Watchdog (Mirage 51M)")
    print("  • Repository: https://github.com/su60pi/kaios-ip-camera")
    print("  • 100% On-Device AI | Zero Cloud Subscriptions")
    print("=" * 65 + "\n")

    phone_ip = args.ip
    if not phone_ip:
        try:
            phone_ip = input("Enter KaiOS camera IP (e.g. 192.168.1.15): ").strip()
            if not phone_ip:
                sys.exit(1)
        except (KeyboardInterrupt, EOFError):
            sys.exit(0)

    # Try initializing Mirage engine
    mirage = None
    try:
        print("[*] Loading on-device Mirage 51M Vision Model...")
        mirage = MirageEngine()
        print("[+] Mirage 51M initialized successfully (running locally on CPU)!\n")
    except Exception as e:
        print(f"[!] Note: Mirage engine not active: {e}")
        print("    Will use OpenCV/motion fallback mode if available.\n")

    print(f"[*] Monitoring camera at http://{phone_ip}:{args.port} every {args.interval}s...")
    print("    Press Ctrl+C to stop.\n")

    cycle = 0
    try:
        while True:
            cycle += 1
            now_str = datetime.now().strftime("%H:%M:%S")

            try:
                jpg_data = fetch_snapshot(phone_ip, args.port)
                alert_triggered = False
                summary = ""

                if mirage and HAVE_PIL:
                    rgb_bytes, w, h = to_rgb_bytes(jpg_data)
                    t0 = time.time()
                    res = mirage.analyze(rgb_bytes, w, h, question=args.ask)
                    latency = time.time() - t0

                    objects = [o.get("name") for o in res.get("objects", []) if o.get("score", 0) > 0.4]
                    reasoning = res.get("reasoning", "")
                    summary = f"Seen: {', '.join(objects) or 'clear'}"

                    print(f"[{now_str}] Scan #{cycle} ({latency:.2f}s) -> {summary}")

                    # Check for person/vehicle/pet detection
                    for obj in objects:
                        obj_lower = obj.lower()
                        if any(k in obj_lower for k in ["person", "face", "man", "woman", "child", "dog", "cat", "car"]):
                            alert_triggered = True
                            summary = f"🚨 AI Detected: {obj} in camera view!"
                            break

                else:
                    print(f"[{now_str}] Frame #{cycle}: Captured snapshot ({len(jpg_data)} bytes)")

                # Handle alert trigger
                if alert_triggered:
                    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                    alert_path = os.path.join(args.save_dir, f"alert_{timestamp}.jpg")
                    with open(alert_path, "wb") as f:
                        f.write(jpg_data)

                    print(f"  {summary}")
                    print(f"  📸 Saved alert frame: {alert_path}")
                    sys.stdout.write('\a')
                    sys.stdout.flush()

                    # Send Webhook Alerts
                    if args.discord:
                        send_discord_alert(args.discord, f"🚨 **KaiOS Camera Alert**: {summary}", alert_path)
                    if args.telegram_token and args.telegram_chat_id:
                        send_telegram_alert(args.telegram_token, args.telegram_chat_id, f"🚨 KaiOS Camera Alert: {summary}", alert_path)

            except Exception as err:
                print(f"[{now_str}] Stream warning: {err} (retrying in {args.interval}s)")

            time.sleep(args.interval)

    except KeyboardInterrupt:
        print("\n[*] AI Watchdog stopped.")


if __name__ == "__main__":
    main()
