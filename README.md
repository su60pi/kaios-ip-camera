# KaiOS IP Camera 📷

> Turn your **KaiOS 2.5.1** phone (Nokia 8110 4G, Alcatel Smartflip/Go Flip, JioPhone, etc.) into a full-featured network IP Camera.
> Compatible with **GerdaPkg**, **OmniSD**, and **WebIDE** sideloading.
> Built to match the feature set of [DigitallyRefined/android-ip-camera](https://github.com/DigitallyRefined/android-ip-camera).
>
> ✅ **Tested & Verified**: Everything checked and tested using **Chrome browser**, **JioPhone (LYF F220B)**, and **Nokia 8110 4G**.

---

## 🚀 Key Features

* 🌎 **Built-in HTTP Streaming Server** (`port 4444`): Access live streams directly from any web browser, VLC, mpv, or NVR.
* 🎛️ **Full Remote Web Control Panel (`/`)**: Rich, responsive dark-mode control interface served directly by the phone.
* 📹 **Motion JPEG Stream (`/video/mjpeg`)**: Compatible with Frigate NVR, Home Assistant MJPEG Camera, MotionEye, OpenCV, and browsers.
* 📸 **Still Snapshots (`/video/snapshot`)**: Fetch high-resolution snapshots with optional sensor query (`?camera=back|front`).
* 🎙️ **Live Audio Stream (`/audio`)**: Stream live microphone audio over chunked WAV (`16-bit PCM mono`).
* 📴 **Display Off / Screen Saver Mode (Key `1`)**: Turns the screen completely pitch black while holding `navigator.requestWakeLock('cpu')`, drastically reducing battery usage and device heat for 24/7 operation.
* ⏺️ **Local Video Recording (`/record/start`, `/record/stop`)**: Record video directly to the device's SD Card (`videos/` folder).
* 📁 **Web Recordings File Manager (`/files`, `/files.json`)**: Browse, download, and delete recordings remotely over the network.
* 🤳 **Dual Camera Switching**: Toggle between Rear and Front (Selfie) cameras dynamically.
* 💡 **Flashlight / Torch Control**: Remote and on-device LED flash control.
* 🔍 **Digital Zoom & Visual Controls**: Digital zoom (1.0x - 4.0x), software exposure, contrast, rotation (0°, 90°, 180°, 270°), and video mirror.
* 🛂 **Optional HTTP Basic Authentication**: Protect stream access with username and password.
* 📊 **Live Telemetry (`/info.json`)**: Real-time battery %, charging status, Wi-Fi signal, actual FPS, viewer count, and uptime.

---

## 📲 Installation via GerdaPkg

This app is packaged in the exact format required by **GerdaPkg** (and OmniSD) for KaiOS:

1. **Locate the Package:**
   The pre-built package is located at:
   ```
   dist/kaios-ip-camera.zip
   ```
2. **Transfer to KaiOS Device:**
   * Insert your micro-SD card into your computer/Termux host or connect your phone via USB.
   * Copy `kaios-ip-camera.zip` to the root of your SD card or to the `Downloads/` directory.
3. **Install:**
   * Open **GerdaPkg** on your KaiOS 2.5 device.
   * Navigate to `kaios-ip-camera.zip` and select **Install**.
   * Wait a few seconds for the package installer to register the app.
   * "IP Camera" will appear in your KaiOS main app menu!

### Alternative Sideloading (OmniSD / WebIDE)
* **OmniSD:** Copy `kaios-ip-camera.zip` to `/sdcard/apps/` and launch OmniSD.
* **KaiOS / Firefox WebIDE:** Open WebIDE, connect via ADB, click **Open Packaged App**, and select the `app/` folder (or install `dist/application.zip`).

---

## ⌨️ KaiOS Keypad Controls (On-Device)

| Key | Action |
| :--- | :--- |
| **Center (Enter)** | **Start / Stop** the HTTP streaming server |
| **SoftLeft (Call / F1)** | **Switch Camera** (Rear ⇄ Front) |
| **SoftRight (F2)** | Open / Close **Settings** menu |
| **Key 1** | **Display Off / Screen Saver Mode** (Saves battery & keeps server running 24/7) |
| **Key 2** | Toggle **Flashlight / Torch** |
| **Key 3** | Snap photo directly to SD Card (`pictures/`) |
| **Key 4 / 6** | Decrease / Increase resolution (`320x240` ⇄ `640x480` ⇄ `1280x720`) |
| **Arrow Up / Down** | Adjust **Digital Zoom** (1.0x to 4.0x) |
| **Key 0** | Mute / Unmute microphone |
| **Any Key** | Instantly wakes display from Screen Saver mode |

---

## 🌐 Server URL Endpoints & Remote API

When the server is running on port `4444`:

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/` | `GET` | **Remote Web Control Panel** (interactive video, audio monitoring, camera controls) |
| `/video/mjpeg` | `GET` | **Live Motion JPEG stream** (`multipart/x-mixed-replace`) |
| `/video/snapshot` | `GET` | **JPEG snapshot** (supports `?camera=front` or `?camera=back`) |
| `/audio` | `GET` | **Live microphone audio stream** (streaming WAV PCM 16-bit mono) |
| `/record/start` | `POST` | Start recording video to SD card storage |
| `/record/stop` | `POST` | Stop recording and finalize video file |
| `/record/status`| `GET` | Current recording status JSON |
| `/files` | `GET` | Web interface to list, download, and delete recorded videos |
| `/files.json` | `GET` | JSON list of all recorded video files |
| `/files/<filename>` | `GET` | Download a recorded video file |
| `/files/<filename>` | `DELETE` | Permanently delete a recorded video file |
| `/info.json` | `GET` | Device telemetry JSON (battery, wifi, fps, viewers, uptime) |
| `/control/start` | `GET/POST`| Enable media streaming |
| `/control/stop` | `GET/POST`| Disable media streaming without shutting down server |

### Remote Control Query Parameters
You can adjust camera parameters remotely at any time by issuing HTTP GET requests:
```
http://[phone-ip]:4444/?torch=on&zoom=2.0&resolution=640x480&rotate=90
```
* `camera=<back|front|toggle>`
* `torch=<on|off|toggle>`
* `zoom=<1.0..4.0>`
* `resolution=<320x240|640x480|1280x720|low|medium|high>`
* `fps=<5|10|15|20|25>`
* `quality=<0.30..0.95>`
* `exposure=<-2.0..2.0>`
* `contrast=<50..150>`
* `rotate=<0|90|180|270>`
* `mirror=<true|false>`

---

## ⚡ Performance & Realistic FPS on KaiOS Hardware

Due to KaiOS 2.5's web architecture (Gecko 48), camera frames are captured to an HTML5 `<canvas>` and encoded to JPEG in software using the CPU (Snapdragon 205/210 dual-core ARM Cortex-A7 @ 1.1 GHz). Below are the realistic FPS expectations:

| Resolution | Quality Setting | Realistic FPS | Primary Limiting Factor |
| :--- | :--- | :--- | :--- |
| **640 × 480 (VGA)** | `0.6` | **8 – 12 FPS** | CPU software JPEG compression time (~70ms/frame) |
| **320 × 240 (QVGA)** | `0.5` | **14 – 16 FPS** | Maximum single-threaded processing limit on Cortex-A7 |
| **160 × 120** | `0.4` | **18 – 20 FPS** | Extreme low quality, small frame size |

> [!NOTE]
> Reaching 20–25 FPS at 480p/720p is physically impossible on KaiOS 2.5 feature phones because each frame requires hardware-accelerated video encoding (H.264/HEVC), which is not exposed to web apps in KaiOS 2.5. To maintain stability and prevent the 512 MB RAM from overflowing, the app automatically drops frames if the CPU is still busy compressing the previous frame.

---

## 🎥 Frigate NVR & Home Assistant Configuration

### Frigate NVR Configuration
Add the camera to your Frigate `config.yml`:

```yaml
cameras:
  kaios-camera:
    ffmpeg:
      inputs:
        - path: http://192.168.1.15:4444/video/mjpeg
          roles:
            - detect
            - record
    detect:
      width: 640
      height: 480
      fps: 15
```

### Home Assistant (MJPEG IP Camera)
In `configuration.yaml`:

```yaml
camera:
  - platform: mjpeg
    name: KaiOS IP Camera
    mjpeg_url: http://192.168.1.15:4444/video/mjpeg
    still_image_url: http://192.168.1.15:4444/video/snapshot
```

### Direct Playback via mpv
```bash
# Video stream
mpv "http://192.168.1.15:4444/video/mjpeg"

# Live audio stream
mpv "http://192.168.1.15:4444/audio"
```

---

## 🛠️ Rebuilding the Package

To rebuild `dist/kaios-ip-camera.zip` after making modifications to `app/`:

```bash
python3 build.py
```
This automatically updates `dist/application.zip` and the outer `dist/kaios-ip-camera.zip`.

---

## ✅ Tested & Verified Environments

Everything checked and tested using **Chrome browser**, **JioPhone (LYF F220B)**, and **Nokia 8110 4G**:
* **JioPhone (LYF F220B)**: KaiOS 2.5.1, Qualcomm MSM8909, 512 MB RAM (Verified 24/7 background streaming, Wi-Fi wake lock, physical 240x320 keypad navigation, video recording).
* **Nokia 8110 4G**: KaiOS 2.5.1, Qualcomm MSM8905/MSM8909, 512 MB RAM (Verified camera HAL streaming, web panel, snapshots, D-Pad Center control).
* **Chrome Browser**: Verified live MJPEG video streaming, live audio monitoring, remote camera controls, snapshot preview, and video file downloads.

---

## 📄 License

This project is licensed under the **Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0)** License.

* ✅ **Modify & Upgrade**: You are free to run, study, modify, adapt, contribute to, and enhance this software.
* ✅ **Share & Distribute**: You can share and redistribute the code and installable packages.
* ❌ **Non-Commercial**: You may **NOT** sell, license, or monetize this software or any derivatives commercially.
* 🔁 **Share-Alike**: If you alter, transform, or build upon this software, you must distribute your contributions under the same CC BY-NC-SA 4.0 license.
* 👤 **Attribution**: You must give appropriate credit to the original author ([su60pi](https://github.com/su60pi)).

See the [LICENSE](LICENSE) file for the full legal text.
