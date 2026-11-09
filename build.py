#!/usr/bin/env python3
"""
Packaging Script for KaiOS IP Camera
Generates:
  1. application.zip (standard Firefox OS / KaiOS webapp archive)
  2. kaios-ip-camera.zip (GerdaPkg / OmniSD installable package)
"""

import os
import sys
import zipfile
import shutil

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
APP_DIR = os.path.join(ROOT_DIR, "app")
PACKAGE_DIR = os.path.join(ROOT_DIR, "package")
DIST_DIR = os.path.join(ROOT_DIR, "dist")

def main():
    print("=" * 60)
    print("  KaiOS IP Camera - GerdaPkg / OmniSD Package Builder")
    print("=" * 60)

    os.makedirs(DIST_DIR, exist_ok=True)

    app_zip_path = os.path.join(DIST_DIR, "application.zip")
    final_zip_path = os.path.join(DIST_DIR, "kaios-ip-camera.zip")

    # Step 1: Build application.zip
    print("\n[1/3] Creating application.zip from app/ ...")
    if os.path.exists(app_zip_path):
        os.remove(app_zip_path)

    with zipfile.ZipFile(app_zip_path, 'w', compression=zipfile.ZIP_DEFLATED) as zf:
        for root, dirs, files in os.walk(APP_DIR):
            for file in sorted(files):
                abs_path = os.path.join(root, file)
                rel_path = os.path.relpath(abs_path, APP_DIR)
                print(f"  + adding: {rel_path}")
                zf.write(abs_path, rel_path)

    print(f"  -> Generated: {app_zip_path} ({os.path.getsize(app_zip_path)} bytes)")

    # Step 2: Build final GerdaPkg package
    print("\n[2/3] Assembling GerdaPkg / OmniSD package (kaios-ip-camera.zip) ...")
    if os.path.exists(final_zip_path):
        os.remove(final_zip_path)

    with zipfile.ZipFile(final_zip_path, 'w', compression=zipfile.ZIP_DEFLATED) as zf:
        # Add application.zip
        zf.write(app_zip_path, "application.zip")
        print("  + adding: application.zip")

        # Add update.webapp
        update_webapp = os.path.join(PACKAGE_DIR, "update.webapp")
        zf.write(update_webapp, "update.webapp")
        print("  + adding: update.webapp")

        # Add metadata.json
        metadata_json = os.path.join(PACKAGE_DIR, "metadata.json")
        zf.write(metadata_json, "metadata.json")
        print("  + adding: metadata.json")

    print(f"  -> Generated: {final_zip_path} ({os.path.getsize(final_zip_path)} bytes)")

    # Step 3: Verify Zip integrity
    print("\n[3/3] Verifying package integrity ...")
    with zipfile.ZipFile(final_zip_path, 'r') as zf:
        bad_file = zf.testzip()
        if bad_file:
            print(f"  [ERROR] Corrupted file in zip: {bad_file}")
            sys.exit(1)
        names = zf.namelist()
        print(f"  Verified files in package: {names}")

    print("\n" + "=" * 60)
    print("  SUCCESS!")
    print(f"  Installable package: {final_zip_path}")
    print("  To install via GerdaPkg:")
    print("    1. Copy kaios-ip-camera.zip to your phone's SD card or Downloads folder")
    print("    2. Open GerdaPkg on your KaiOS 2.5 device")
    print("    3. Select kaios-ip-camera.zip and press Install")
    print("=" * 60)

if __name__ == "__main__":
    main()
