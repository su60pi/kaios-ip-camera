// Web Control Panel HTML & Assets (served completely self-contained for offline LAN use)
window.WebPanel = (function() {
  function getIndexHtml(host, port) {
    return '<!DOCTYPE html>\n' +
'<html lang="en">\n' +
'<head>\n' +
'  <meta charset="utf-8">\n' +
'  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
'  <title>KaiOS IP Camera - Web Control</title>\n' +
'  <style>\n' +
'    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }\n' +
'    body { background-color: #0f172a; color: #f8fafc; min-height: 100vh; display: flex; flex-direction: column; }\n' +
'    header { background: #1e293b; padding: 12px 20px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #334155; position: sticky; top: 0; z-index: 50; }\n' +
'    .logo-area { display: flex; align-items: center; gap: 12px; }\n' +
'    .logo-badge { width: 32px; height: 32px; border-radius: 8px; background: linear-gradient(135deg, #0284c7, #0369a1); display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 18px; }\n' +
'    h1 { font-size: 1.15rem; font-weight: 600; letter-spacing: -0.02em; }\n' +
'    .status-badge { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 9999px; font-size: 0.75rem; font-weight: 500; background: #064e3b; color: #34d399; }\n' +
'    .status-dot { width: 8px; height: 8px; border-radius: 50%; background: #10b981; animation: pulse 2s infinite; }\n' +
'    @keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(0.9); } }\n' +
'    .top-telemetry { display: flex; align-items: center; gap: 16px; font-size: 0.82rem; color: #94a3b8; }\n' +
'    .tele-item { display: flex; align-items: center; gap: 5px; }\n' +
'    .tele-item b { color: #f1f5f9; }\n' +
'    main { flex: 1; padding: 20px; max-width: 1200px; margin: 0 auto; width: 100%; display: grid; grid-template-columns: 1fr 340px; gap: 20px; }\n' +
'    @media (max-width: 900px) { main { grid-template-columns: 1fr; } }\n' +
'    .video-card { background: #1e293b; border-radius: 12px; overflow: hidden; border: 1px solid #334155; display: flex; flex-direction: column; }\n' +
'    .video-container { position: relative; width: 100%; background: #000; min-height: 280px; display: flex; align-items: center; justify-content: center; overflow: hidden; }\n' +
'    #stream-view { width: 100%; height: auto; max-height: 70vh; object-fit: contain; display: block; }\n' +
'    .video-overlay { position: absolute; top: 10px; left: 10px; right: 10px; display: flex; justify-content: space-between; pointer-events: none; }\n' +
'    .overlay-tag { background: rgba(15, 23, 42, 0.75); backdrop-filter: blur(4px); padding: 4px 10px; border-radius: 6px; font-size: 0.75rem; font-weight: 500; }\n' +
'    .video-toolbar { padding: 12px 16px; background: #1e293b; border-top: 1px solid #334155; display: flex; flex-wrap: wrap; gap: 8px; align-items: center; justify-content: space-between; }\n' +
'    .btn-group { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }\n' +
'    button, .btn { background: #334155; color: #f8fafc; border: 1px solid #475569; border-radius: 8px; padding: 7px 14px; font-size: 0.85rem; font-weight: 500; cursor: pointer; transition: all 0.15s ease; display: inline-flex; align-items: center; gap: 6px; text-decoration: none; }\n' +
'    button:hover, .btn:hover { background: #475569; }\n' +
'    button:active, .btn:active { transform: translateY(1px); }\n' +
'    button.primary, .btn.primary { background: #0284c7; border-color: #0369a1; }\n' +
'    button.primary:hover, .btn.primary:hover { background: #0369a1; }\n' +
'    button.danger, .btn.danger { background: #dc2626; border-color: #b91c1c; }\n' +
'    button.danger:hover, .btn.danger:hover { background: #b91c1c; }\n' +
'    button.active-toggle { background: #10b981; border-color: #059669; color: #fff; }\n' +
'    .sidebar { display: flex; flex-direction: column; gap: 16px; }\n' +
'    .card { background: #1e293b; border-radius: 12px; padding: 16px; border: 1px solid #334155; }\n' +
'    .card-title { font-size: 0.95rem; font-weight: 600; margin-bottom: 12px; display: flex; align-items: center; justify-content: space-between; color: #38bdf8; }\n' +
'    .form-group { margin-bottom: 12px; }\n' +
'    .form-group:last-child { margin-bottom: 0; }\n' +
'    label { display: block; font-size: 0.78rem; font-weight: 500; color: #94a3b8; margin-bottom: 4px; }\n' +
'    select, input[type="range"] { width: 100%; }\n' +
'    select { background: #0f172a; border: 1px solid #334155; color: #f8fafc; border-radius: 6px; padding: 7px 10px; font-size: 0.85rem; outline: none; }\n' +
'    .range-wrap { display: flex; align-items: center; gap: 10px; }\n' +
'    .range-val { font-size: 0.8rem; font-weight: bold; width: 38px; text-align: right; color: #38bdf8; }\n' +
'    input[type="range"] { -webkit-appearance: none; height: 6px; border-radius: 3px; background: #334155; outline: none; }\n' +
'    input[type="range"]::-webkit-slider-thumb { -webkit-appearance: none; width: 16px; height: 16px; border-radius: 50%; background: #38bdf8; cursor: pointer; }\n' +
'    .rot-buttons { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }\n' +
'    .rot-btn { padding: 6px 0; justify-content: center; font-size: 0.78rem; }\n' +
'    .rot-btn.active-rot { background: #0284c7; border-color: #0369a1; }\n' +
'    .url-box { background: #0f172a; border: 1px solid #334155; border-radius: 6px; padding: 8px 10px; font-family: monospace; font-size: 0.75rem; color: #a5f3fc; word-break: break-all; margin-top: 6px; }\n' +
'    footer { background: #1e293b; padding: 14px 20px; text-align: center; font-size: 0.78rem; color: #64748b; border-top: 1px solid #334155; margin-top: auto; }\n' +
'  </style>\n' +
'</head>\n' +
'<body>\n' +
'  <header>\n' +
'    <div class="logo-area">\n' +
'      <div class="logo-badge">&#128247;</div>\n' +
'      <div>\n' +
'        <h1>KaiOS IP Camera</h1>\n' +
'        <span class="status-badge"><span class="status-dot"></span> LIVE STREAMING</span>\n' +
'      </div>\n' +
'    </div>\n' +
'    <div class="top-telemetry">\n' +
'      <div class="tele-item">&#128267; <span id="tele-battery">--%</span></div>\n' +
'      <div class="tele-item">&#128246; <span id="tele-wifi">--</span></div>\n' +
'      <div class="tele-item">&#128101; Viewers: <b id="tele-clients">0</b></div>\n' +
'      <div class="tele-item">&#9201; <span id="tele-uptime">00:00:00</span></div>\n' +
'    </div>\n' +
'  </header>\n' +
'  <main>\n' +
'    <div class="video-card">\n' +
'      <div class="video-container" id="video-box">\n' +
'        <img id="stream-view" src="/video/mjpeg" alt="Live Stream">\n' +
'        <div class="video-overlay">\n' +
'          <span class="overlay-tag" id="tag-res">640x480</span>\n' +
'          <span class="overlay-tag" id="tag-fps">-- fps</span>\n' +
'        </div>\n' +
'      </div>\n' +
'      <div class="video-toolbar">\n' +
'        <div class="btn-group">\n' +
'          <button id="btn-camera" onclick="toggleCamera()">&#128260; Switch Camera</button>\n' +
'          <button id="btn-torch" onclick="toggleTorch()">&#128161; Flashlight</button>\n' +
'          <button id="btn-snapshot" class="primary" onclick="takeSnapshot()">&#128248; Snapshot</button>\n' +
'          <div style="display:inline-flex; align-items:stretch; background:#0f172a; border:1px solid #475569; border-radius:8px; overflow:hidden;">\n' +
'            <button id="btn-record" onclick="toggleRecord()" style="border:none; border-radius:0; padding:7px 11px;">&#9210; <span id="rec-label">Record</span></button>\n' +
'            <select id="sel-rec-audio" style="border:none; border-left:1px solid #334155; background:#0f172a; color:#38bdf8; font-size:0.78rem; font-weight:500; padding:6px 8px; outline:none; cursor:pointer;" title="Recording Audio Mode">\n' +
'              <option value="1" selected>&#127908; Audio</option>\n' +
'              <option value="0">&#128263; Muted</option>\n' +
'            </select>\n' +
'            <select id="sel-rec-quality" style="border:none; border-left:1px solid #334155; background:#0f172a; color:#38bdf8; font-size:0.78rem; font-weight:500; padding:6px 8px; outline:none; cursor:pointer;" title="Recording Video Quality / Bitrate" onchange="onRecQualityChange(this.value)">\n' +
'              <option value="200000">200k (Low)</option>\n' +
'              <option value="350000" selected>350k (Med)</option>\n' +
'              <option value="750000">750k (High)</option>\n' +
'              <option value="1500000">1.5M (Max)</option>\n' +
'            </select>\n' +
'          </div>\n' +
'        </div>\n' +
'        <div class="btn-group" style="align-items:center;">\n' +
'          <button id="btn-audio" onclick="toggleAudio()">&#128266; Listen Audio</button>\n' +
'          <span style="font-size:0.75rem; color:#94a3b8; display:inline-flex; align-items:center; gap:4px;">\n' +
'            Vol: <input type="range" id="rng-vol" min="0" max="100" value="100" style="width:70px; vertical-align:middle;" title="Media Volume" oninput="setVolume(this.value)">\n' +
'          </span>\n' +
'          <a href="/files" class="btn" target="_blank">&#128193; Recordings</a>\n' +
'        </div>\n' +
'      </div>\n' +
'    </div>\n' +
'    <div class="sidebar">\n' +
'      <div class="card">\n' +
'        <div class="card-title">Stream Controls</div>\n' +
'        <div class="form-group">\n' +
'          <label>Resolution</label>\n' +
'          <select id="sel-res" onchange="setControl(\'resolution\', this.value)">\n' +
'            <option value="320x240">320x240 (QVGA - Fast/Low Heat)</option>\n' +
'            <option value="640x480" selected>640x480 (VGA - Recommended)</option>\n' +
'            <option value="1280x720">1280x720 (720p HD)</option>\n' +
'          </select>\n' +
'        </div>\n' +
'        <div class="form-group">\n' +
'          <label>Target Frame Rate</label>\n' +
'          <select id="sel-fps" onchange="setControl(\'fps\', this.value)">\n' +
'            <option value="5">5 FPS (Ultra Battery Saver)</option>\n' +
'            <option value="10">10 FPS (Smooth / Low Bandwidth)</option>\n' +
'            <option value="15" selected>15 FPS (Standard)</option>\n' +
'            <option value="20">20 FPS</option>\n' +
'            <option value="25">25 FPS</option>\n' +
'          </select>\n' +
'        </div>\n' +
'        <div class="form-group">\n' +
'          <label>JPEG Quality</label>\n' +
'          <div class="range-wrap">\n' +
'            <input type="range" id="rng-qual" min="30" max="95" value="60" oninput="updateVal(\'val-qual\', this.value+\'%\')" onchange="setControl(\'quality\', (this.value/100).toFixed(2))">\n' +
'            <span class="range-val" id="val-qual">60%</span>\n' +
'          </div>\n' +
'        </div>\n' +
'        <div class="form-group">\n' +
'          <label>Digital Zoom</label>\n' +
'          <div class="range-wrap">\n' +
'            <input type="range" id="rng-zoom" min="10" max="40" value="10" oninput="updateVal(\'val-zoom\', (this.value/10).toFixed(1)+\'x\')" onchange="setControl(\'zoom\', (this.value/10).toFixed(1))">\n' +
'            <span class="range-val" id="val-zoom">1.0x</span>\n' +
'          </div>\n' +
'        </div>\n' +
'        <div class="form-group">\n' +
'          <label>Exposure / Brightness</label>\n' +
'          <div class="range-wrap">\n' +
'            <input type="range" id="rng-exp" min="-20" max="20" value="0" oninput="updateVal(\'val-exp\', (this.value/10).toFixed(1))" onchange="setControl(\'exposure\', (this.value/10).toFixed(1))">\n' +
'            <span class="range-val" id="val-exp">0.0</span>\n' +
'          </div>\n' +
'        </div>\n' +
'        <div class="form-group">\n' +
'          <label>Contrast</label>\n' +
'          <div class="range-wrap">\n' +
'            <input type="range" id="rng-con" min="50" max="150" value="100" oninput="updateVal(\'val-con\', this.value+\'%\')" onchange="setControl(\'contrast\', this.value)">\n' +
'            <span class="range-val" id="val-con">100%</span>\n' +
'          </div>\n' +
'        </div>\n' +
'        <div class="form-group">\n' +
'          <label>Recording Quality / Bitrate</label>\n' +
'          <select id="sel-rec-qual-side" onchange="onRecQualityChange(this.value)">\n' +
'            <option value="200000">Low (200 kbps - Ultra Small)</option>\n' +
'            <option value="350000" selected>Medium (350 kbps - Balanced Recommended)</option>\n' +
'            <option value="750000">High (750 kbps - Clear)</option>\n' +
'            <option value="1500000">Maximum (1500 kbps - Full Bitrate)</option>\n' +
'          </select>\n' +
'        </div>\n' +
'        <div class="form-group">\n' +
'          <label>Rotation</label>\n' +
'          <div class="rot-buttons">\n' +
'            <button id="rot-0" class="rot-btn active-rot" onclick="setControl(\'rotate\', 0)">0 deg</button>\n' +
'            <button id="rot-90" class="rot-btn" onclick="setControl(\'rotate\', 90)">90 deg</button>\n' +
'            <button id="rot-180" class="rot-btn" onclick="setControl(\'rotate\', 180)">180 deg</button>\n' +
'            <button id="rot-270" class="rot-btn" onclick="setControl(\'rotate\', 270)">270 deg</button>\n' +
'          </div>\n' +
'        </div>\n' +
'        <div class="form-group">\n' +
'          <button id="btn-mirror" style="width:100%; justify-content:center;" onclick="toggleMirror()">&#129694; Toggle Mirror</button>\n' +
'        </div>\n' +
'      </div>\n' +
'      <div class="card">\n' +
'        <div class="card-title">Integration & Stream URLs</div>\n' +
'        <label>MJPEG Stream URL (Frigate, HA, VLC):</label>\n' +
'        <div class="url-box" id="url-mjpeg">http://' + host + ':' + port + '/video/mjpeg</div>\n' +
'        <label style="margin-top:8px;">Snapshot URL:</label>\n' +
'        <div class="url-box" id="url-snap">http://' + host + ':' + port + '/video/snapshot</div>\n' +
'        <label style="margin-top:8px;">Audio Stream URL:</label>\n' +
'        <div class="url-box" id="url-audio">http://' + host + ':' + port + '/audio</div>\n' +
'      </div>\n' +
'    </div>\n' +
'  </main>\n' +
'  <audio id="audio-player" playsinline preload="none"></audio>\n' +
'  <footer>\n' +
'    KaiOS IP Camera &bull; Compatible with GerdaOS / KaiOS 2.5 &bull; DigitallyRefined Android IP Camera Protocol\n' +
'  </footer>\n' +
'  <script>\n' +
'    var currentCam = "back";\n' +
'    var torchOn = false;\n' +
'    var isRecording = false;\n' +
'    var mirrorOn = false;\n' +
'    var currentRotation = 0;\n' +
'    var audioPlaying = false;\n' +
'    var audioCtx = null;\n' +
'    var audioStreamController = null;\n' +
'\n' +
'    function updateVal(id, text) { document.getElementById(id).textContent = text; }\n' +
'\n' +
'    function highlightRotBtn(rot) {\n' +
'      [0, 90, 180, 270].forEach(function(deg) {\n' +
'        var el = document.getElementById("rot-" + deg);\n' +
'        if (el) el.classList.toggle("active-rot", deg === Number(rot));\n' +
'      });\n' +
'    }\n' +
'\n' +
'    function syncControls(info) {\n' +
'      if (!info) return;\n' +
'      var activeTag = document.activeElement ? document.activeElement.tagName : "";\n' +
'      if (activeTag === "INPUT") return;\n' +
'\n' +
'      if (info.resolution) {\n' +
'        var elRes = document.getElementById("sel-res");\n' +
'        if (elRes && elRes.value !== info.resolution) elRes.value = info.resolution;\n' +
'      }\n' +
'      if (info.targetFps) {\n' +
'        var elFps = document.getElementById("sel-fps");\n' +
'        if (elFps && elFps.value !== String(info.targetFps)) elFps.value = String(info.targetFps);\n' +
'      }\n' +
'      if (info.quality !== undefined) {\n' +
'        var qPct = Math.round(info.quality * 100);\n' +
'        var elQ = document.getElementById("rng-qual");\n' +
'        if (elQ) elQ.value = qPct;\n' +
'        updateVal("val-qual", qPct + "%");\n' +
'      }\n' +
'      if (info.zoom !== undefined) {\n' +
'        var elZ = document.getElementById("rng-zoom");\n' +
'        if (elZ) elZ.value = Math.round(info.zoom * 10);\n' +
'        updateVal("val-zoom", Number(info.zoom).toFixed(1) + "x");\n' +
'      }\n' +
'      if (info.exposure !== undefined) {\n' +
'        var elE = document.getElementById("rng-exp");\n' +
'        if (elE) elE.value = Math.round(info.exposure * 10);\n' +
'        updateVal("val-exp", Number(info.exposure).toFixed(1));\n' +
'      }\n' +
'      if (info.contrast !== undefined) {\n' +
'        var elC = document.getElementById("rng-con");\n' +
'        if (elC) elC.value = info.contrast;\n' +
'        updateVal("val-con", info.contrast + "%");\n' +
'      }\n' +
'      if (info.mirror !== undefined) {\n' +
'        mirrorOn = !!info.mirror;\n' +
'        var btnM = document.getElementById("btn-mirror");\n' +
'        if (btnM) btnM.classList.toggle("active-toggle", mirrorOn);\n' +
'      }\n' +
'      if (info.rotation !== undefined) {\n' +
'        currentRotation = Number(info.rotation);\n' +
'        highlightRotBtn(currentRotation);\n' +
'      }\n' +
'    }\n' +
'\n' +
'    function setControl(key, val) {\n' +
'      fetch("/set?" + encodeURIComponent(key) + "=" + encodeURIComponent(val))\n' +
'        .then(function(r) { return r.json(); })\n' +
'        .then(function(data) {\n' +
'          if (data && data.settings) syncControls(data.settings);\n' +
'          pollInfo();\n' +
'        })\n' +
'        .catch(function() {\n' +
'          fetch("/?" + encodeURIComponent(key) + "=" + encodeURIComponent(val))\n' +
'            .then(function() { pollInfo(); });\n' +
'        });\n' +
'      if (key === "resolution" || key === "camera") {\n' +
'        setTimeout(function() {\n' +
'          var img = document.getElementById("stream-view");\n' +
'          if (img) img.src = "/video/mjpeg?t=" + Date.now();\n' +
'        }, 1000);\n' +
'      }\n' +
'    }\n' +
'\n' +
'    function toggleCamera() {\n' +
'      currentCam = (currentCam === "back" ? "front" : "back");\n' +
'      setControl("camera", currentCam);\n' +
'    }\n' +
'\n' +
'    function toggleTorch() {\n' +
'      torchOn = !torchOn;\n' +
'      setControl("torch", torchOn ? "on" : "off");\n' +
'      document.getElementById("btn-torch").classList.toggle("active-toggle", torchOn);\n' +
'    }\n' +
'\n' +
'    function toggleMirror() {\n' +
'      mirrorOn = !mirrorOn;\n' +
'      setControl("mirror", mirrorOn ? "true" : "false");\n' +
'      document.getElementById("btn-mirror").classList.toggle("active-toggle", mirrorOn);\n' +
'    }\n' +
'\n' +
'    function takeSnapshot() {\n' +
'      window.open("/video/snapshot?t=" + Date.now(), "_blank");\n' +
'    }\n' +
'\n' +
'    function onRecQualityChange(val) {\n' +
'      var sTop = document.getElementById("sel-rec-quality");\n' +
'      var sSide = document.getElementById("sel-rec-qual-side");\n' +
'      if (sTop && sTop.value !== String(val)) sTop.value = String(val);\n' +
'      if (sSide && sSide.value !== String(val)) sSide.value = String(val);\n' +
'      setControl("recBitrate", val);\n' +
'    }\n' +
'\n' +
'    function toggleRecord() {\n' +
'      var selAudio = document.getElementById("sel-rec-audio");\n' +
'      var withAudio = selAudio ? selAudio.value === "1" : true;\n' +
'      var selQual = document.getElementById("sel-rec-quality") || document.getElementById("sel-rec-qual-side");\n' +
'      var bitrate = selQual ? parseInt(selQual.value, 10) : 350000;\n' +
'      var endpoint = isRecording ? "/record/stop" : ("/record/start?audio=" + (withAudio ? "1" : "0") + "&bitrate=" + bitrate);\n' +
'      fetch(endpoint, { method: "POST" })\n' +
'        .then(function(r) { return r.json(); })\n' +
'        .then(function(data) {\n' +
'          isRecording = data.recording;\n' +
'          var btn = document.getElementById("btn-record");\n' +
'          var lbl = document.getElementById("rec-label");\n' +
'          var sel = document.getElementById("sel-rec-audio");\n' +
'          var selQ = document.getElementById("sel-rec-quality");\n' +
'          var selQSide = document.getElementById("sel-rec-qual-side");\n' +
'          if (isRecording) {\n' +
'            btn.classList.add("danger");\n' +
'            var modeTxt = data.withAudio ? " (Audio)" : " (No Audio)";\n' +
'            lbl.textContent = "Stop" + modeTxt;\n' +
'            if (sel) sel.disabled = true;\n' +
'            if (selQ) selQ.disabled = true;\n' +
'            if (selQSide) selQSide.disabled = true;\n' +
'          } else {\n' +
'            btn.classList.remove("danger");\n' +
'            lbl.textContent = "Record";\n' +
'            if (sel) sel.disabled = false;\n' +
'            if (selQ) selQ.disabled = false;\n' +
'            if (selQSide) selQSide.disabled = false;\n' +
'            var modeNotice = data.withAudio ? "With Audio" : "Without Audio";\n' +
'            var sizeNotice = data.sizeBytes ? " (" + (data.sizeBytes / 1024).toFixed(1) + " KB)" : "";\n' +
'            alert("Recording saved to storage (" + modeNotice + sizeNotice + "):\\n" + (data.filename || ""));\n' +
'          }\n' +
'        });\n' +
'    }\n' +
'\n' +
'    function toggleAudio() {\n' +
'      if (audioPlaying) {\n' +
'        stopAudioPlayback();\n' +
'      } else {\n' +
'        startAudioPlayback();\n' +
'      }\n' +
'    }\n' +
'\n' +
'    function stopAudioPlayback() {\n' +
'      var btn = document.getElementById("btn-audio");\n' +
'      var player = document.getElementById("audio-player");\n' +
'      if (player) {\n' +
'        player.pause();\n' +
'        player.removeAttribute("src");\n' +
'        try { player.load(); } catch (e) {}\n' +
'      }\n' +
'      if (audioStreamController) {\n' +
'        try { audioStreamController.abort(); } catch (e) {}\n' +
'        audioStreamController = null;\n' +
'      }\n' +
'      if (audioCtx) {\n' +
'        try { audioCtx.close(); } catch (e) {}\n' +
'        audioCtx = null;\n' +
'      }\n' +
'      audioPlaying = false;\n' +
'      if (btn) {\n' +
'        btn.classList.remove("active-toggle");\n' +
'        btn.innerHTML = "&#128266; Listen Audio";\n' +
'      }\n' +
'    }\n' +
'\n' +
'    function startAudioPlayback() {\n' +
'      var btn = document.getElementById("btn-audio");\n' +
'      var player = document.getElementById("audio-player");\n' +
'      if (!btn || !player) return;\n' +
'\n' +
'      audioPlaying = true;\n' +
'      btn.classList.add("active-toggle");\n' +
'      btn.textContent = "Connecting Audio...";\n' +
'\n' +
'      // Standard HTML5 Audio - Native Media Audio (STREAM_MUSIC) on Android & iOS\n' +
'      player.src = "/audio?t=" + Date.now();\n' +
'      var rngVol = document.getElementById("rng-vol");\n' +
'      player.volume = rngVol ? Number(rngVol.value) / 100 : 1.0;\n' +
'\n' +
'      var playPromise = player.play();\n' +
'      if (playPromise !== undefined) {\n' +
'        playPromise.then(function() {\n' +
'          btn.innerHTML = "&#128263; Stop Audio";\n' +
'        }).catch(function(err) {\n' +
'          console.warn("HTML5 Audio play, trying Web Audio Media session fallback:", err);\n' +
'          startWebAudioMedia();\n' +
'        });\n' +
'      } else {\n' +
'        btn.innerHTML = "&#128263; Stop Audio";\n' +
'      }\n' +
'    }\n' +
'\n' +
'    function startWebAudioMedia() {\n' +
'      var btn = document.getElementById("btn-audio");\n' +
'      var AudioContext = window.AudioContext || window.webkitAudioContext;\n' +
'      if (!AudioContext) {\n' +
'        stopAudioPlayback();\n' +
'        return;\n' +
'      }\n' +
'\n' +
'      try {\n' +
'        // latencyHint: "playback" forces the OS audio server to treat this as Media Audio (STREAM_MUSIC)\n' +
'        audioCtx = new AudioContext({ latencyHint: "playback" });\n' +
'      } catch (e) {\n' +
'        audioCtx = new AudioContext();\n' +
'      }\n' +
'\n' +
'      if (audioCtx.state === "suspended") {\n' +
'        audioCtx.resume();\n' +
'      }\n' +
'\n' +
'      audioStreamController = new AbortController();\n' +
'      fetch("/audio?t=" + Date.now(), { signal: audioStreamController.signal })\n' +
'        .then(function(res) {\n' +
'          if (!res.body || !res.body.getReader) {\n' +
'            stopAudioPlayback();\n' +
'            return;\n' +
'          }\n' +
'          btn.innerHTML = "&#128263; Stop Audio";\n' +
'          var reader = res.body.getReader();\n' +
'          var isFirstChunk = true;\n' +
'          var sampleRate = 48000;\n' +
'          var nextStartTime = 0;\n' +
'\n' +
'          function pump() {\n' +
'            reader.read().then(function(result) {\n' +
'              if (result.done || !audioPlaying) return;\n' +
'              var bytes = result.value;\n' +
'              if (isFirstChunk) {\n' +
'                if (bytes.byteLength >= 44) {\n' +
'                  var dv = new DataView(bytes.buffer, bytes.byteOffset, 44);\n' +
'                  sampleRate = dv.getUint32(24, true) || 48000;\n' +
'                  bytes = bytes.subarray(44);\n' +
'                }\n' +
'                isFirstChunk = false;\n' +
'              }\n' +
'\n' +
'              if (bytes.byteLength >= 2 && audioCtx) {\n' +
'                var numSamples = Math.floor(bytes.byteLength / 2);\n' +
'                var int16 = new Int16Array(bytes.buffer, bytes.byteOffset, numSamples);\n' +
'                var buf = audioCtx.createBuffer(1, numSamples, sampleRate);\n' +
'                var chan = buf.getChannelData(0);\n' +
'                for (var i = 0; i < numSamples; i++) {\n' +
'                  chan[i] = int16[i] / 32768.0;\n' +
'                }\n' +
'\n' +
'                var src = audioCtx.createBufferSource();\n' +
'                src.buffer = buf;\n' +
'                src.connect(audioCtx.destination);\n' +
'\n' +
'                var now = audioCtx.currentTime;\n' +
'                if (nextStartTime < now) {\n' +
'                  nextStartTime = now;\n' +
'                }\n' +
'                src.start(nextStartTime);\n' +
'                nextStartTime += buf.duration;\n' +
'              }\n' +
'              pump();\n' +
'            }).catch(function(e) {\n' +
'              if (audioPlaying) stopAudioPlayback();\n' +
'            });\n' +
'          }\n' +
'          pump();\n' +
'        })\n' +
'        .catch(function(e) {\n' +
'          if (audioPlaying) stopAudioPlayback();\n' +
'        });\n' +
'    }\n' +
'\n' +
'    function setVolume(val) {\n' +
'      var player = document.getElementById("audio-player");\n' +
'      if (player) {\n' +
'        player.volume = Math.max(0, Math.min(1, Number(val) / 100));\n' +
'      }\n' +
'    }\n' +
'\n' +
'    function pollInfo() {\n' +
'      fetch("/info.json")\n' +
'        .then(function(r) { return r.json(); })\n' +
'        .then(function(info) {\n' +
'          document.getElementById("tele-battery").textContent = info.battery + "%" + (info.charging ? " [Charging]" : "");\n' +
'          document.getElementById("tele-wifi").textContent = info.wifi && info.wifi.signal ? info.wifi.signal + "%" : (info.ip || "Connected");\n' +
'          document.getElementById("tele-clients").textContent = info.clients || 0;\n' +
'          document.getElementById("tag-res").textContent = info.resolution || "640x480";\n' +
'          document.getElementById("tag-fps").textContent = (info.fps || 0) + " fps";\n' +
'          currentCam = info.camera || "back";\n' +
'          torchOn = !!info.torch;\n' +
'          document.getElementById("btn-torch").classList.toggle("active-toggle", torchOn);\n' +
'          syncControls(info);\n' +
'          var sec = info.uptime || 0;\n' +
'          var h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;\n' +
'          document.getElementById("tele-uptime").textContent = (h < 10 ? "0" + h : h) + ":" + (m < 10 ? "0" + m : m) + ":" + (s < 10 ? "0" + s : s);\n' +
'          if (info.recordBitrate) {\n' +
'            var sTop = document.getElementById("sel-rec-quality");\n' +
'            var sSide = document.getElementById("sel-rec-qual-side");\n' +
'            if (sTop && document.activeElement !== sTop && sTop.value !== String(info.recordBitrate)) {\n' +
'              sTop.value = String(info.recordBitrate);\n' +
'            }\n' +
'            if (sSide && document.activeElement !== sSide && sSide.value !== String(info.recordBitrate)) {\n' +
'              sSide.value = String(info.recordBitrate);\n' +
'            }\n' +
'          }\n' +
'          if (info.recording !== undefined) {\n' +
'            isRecording = info.recording;\n' +
'            var btn = document.getElementById("btn-record");\n' +
'            var lbl = document.getElementById("rec-label");\n' +
'            var sel = document.getElementById("sel-rec-audio");\n' +
'            var selQ = document.getElementById("sel-rec-quality");\n' +
'            var selQSide = document.getElementById("sel-rec-qual-side");\n' +
'            if (btn) btn.classList.toggle("danger", isRecording);\n' +
'            if (lbl) {\n' +
'              if (isRecording) {\n' +
'                lbl.textContent = info.recordingWithAudio ? "Stop (Audio)" : "Stop (No Audio)";\n' +
'              } else {\n' +
'                lbl.textContent = "Record";\n' +
'              }\n' +
'            }\n' +
'            if (sel) sel.disabled = isRecording;\n' +
'            if (selQ) selQ.disabled = isRecording;\n' +
'            if (selQSide) selQSide.disabled = isRecording;\n' +
'          }\n' +
'        })\n' +
'        .catch(function(e) {});\n' +
'    }\n' +
'    var streamImg = document.getElementById("stream-view");\n' +
'    if (streamImg) {\n' +
'      streamImg.onerror = function() {\n' +
'        setTimeout(function() {\n' +
'          var el = document.getElementById("stream-view");\n' +
'          if (el) el.src = "/video/mjpeg?t=" + Date.now();\n' +
'        }, 1200);\n' +
'      };\n' +
'    }\n' +
'    setInterval(pollInfo, 2500);\n' +
'    pollInfo();\n' +
'  </script>\n' +
'</body>\n' +
'</html>';
  }

  function getFilesHtml() {
    return '<!DOCTYPE html>\n' +
'<html lang="en">\n' +
'<head>\n' +
'  <meta charset="utf-8">\n' +
'  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
'  <title>KaiOS IP Camera - Recordings</title>\n' +
'  <style>\n' +
'    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }\n' +
'    body { background-color: #0f172a; color: #f8fafc; min-height: 100vh; padding: 24px 16px; }\n' +
'    .container { max-width: 900px; margin: 0 auto; }\n' +
'    header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; padding-bottom: 12px; border-bottom: 1px solid #334155; }\n' +
'    h1 { font-size: 1.25rem; font-weight: 600; display: flex; align-items: center; gap: 8px; }\n' +
'    a.btn { background: #334155; color: #f8fafc; border: 1px solid #475569; border-radius: 8px; padding: 8px 14px; font-size: 0.85rem; font-weight: 500; text-decoration: none; display: inline-flex; align-items: center; gap: 6px; }\n' +
'    a.btn:hover { background: #475569; }\n' +
'    .file-table { width: 100%; border-collapse: collapse; background: #1e293b; border-radius: 12px; overflow: hidden; border: 1px solid #334155; }\n' +
'    th, td { padding: 12px 16px; text-align: left; font-size: 0.85rem; }\n' +
'    th { background: #0f172a; color: #94a3b8; font-weight: 500; border-bottom: 1px solid #334155; }\n' +
'    tr:not(:last-child) td { border-bottom: 1px solid #334155; }\n' +
'    tr:hover td { background: #26334d; }\n' +
'    .file-name { font-weight: 500; color: #38bdf8; text-decoration: none; }\n' +
'    .file-name:hover { text-decoration: underline; }\n' +
'    .btn-del { background: #7f1d1d; color: #fca5a5; border: 1px solid #991b1b; border-radius: 6px; padding: 4px 10px; font-size: 0.75rem; cursor: pointer; }\n' +
'    .btn-del:hover { background: #991b1b; color: #fff; }\n' +
'    .empty-state { padding: 40px; text-align: center; color: #64748b; font-size: 0.9rem; }\n' +
'  </style>\n' +
'</head>\n' +
'<body>\n' +
'  <div class="container">\n' +
'    <header>\n' +
'      <h1>&#128193; Recorded Videos on KaiOS Device</h1>\n' +
'      <a href="/" class="btn">&#11013; Back to Camera</a>\n' +
'    </header>\n' +
'    <table class="file-table">\n' +
'      <thead>\n' +
'        <tr>\n' +
'          <th>Filename</th>\n' +
'          <th>Size</th>\n' +
'          <th>Date Modified</th>\n' +
'          <th style="text-align:right;">Actions</th>\n' +
'        </tr>\n' +
'      </thead>\n' +
'      <tbody id="file-list">\n' +
'      </tbody>\n' +
'    </table>\n' +
'  </div>\n' +
'  <script>\n' +
'    function loadFiles() {\n' +
'      fetch("/files.json")\n' +
'        .then(function(r) { return r.json(); })\n' +
'        .then(function(data) {\n' +
'          var tbody = document.getElementById("file-list");\n' +
'          tbody.innerHTML = "";\n' +
'          var files = data.files || [];\n' +
'          if (files.length === 0) {\n' +
'            tbody.innerHTML = "<tr><td colspan=\\\"4\\\" class=\\\"empty-state\\\">No recorded videos found yet. Use the Record button on the live view to record.</td></tr>";\n' +
'            return;\n' +
'          }\n' +
'          files.forEach(function(f) {\n' +
'            var tr = document.createElement("tr");\n' +
'            var sizeMb = (f.sizeBytes / (1024 * 1024)).toFixed(2) + " MB";\n' +
'            var dateStr = new Date(f.lastModifiedMs).toLocaleString();\n' +
'            var audioTag = f.name.indexOf(\'_audio\') !== -1 ? \' <span style="font-size:0.7rem; background:#065f46; color:#6ee7b7; padding:2px 6px; border-radius:4px; font-weight:bold;">&#127908; Audio</span>\' : (f.name.indexOf(\'_noaudio\') !== -1 ? \' <span style="font-size:0.7rem; background:#374151; color:#9ca3af; padding:2px 6px; border-radius:4px;">&#128263; Muted</span>\' : \'\');\n' +
'            tr.innerHTML = "<td><a class=\\\"file-name\\\" href=\\\"/files/" + encodeURIComponent(f.name) + "\\\" download>" + f.name + "</a>" + audioTag + "</td>" +\n' +
'                           "<td>" + sizeMb + "</td>" +\n' +
'                           "<td>" + dateStr + "</td>" +\n' +
'                           "<td style=\\\"text-align:right;\\\"><button class=\\\"btn-del\\\" onclick=\\\"deleteFile(\'" + f.name + "\')\\\">Delete</button></td>";\n' +
'            tbody.appendChild(tr);\n' +
'          });\n' +
'        });\n' +
'    }\n' +
'    function deleteFile(name) {\n' +
'      if (!confirm("Delete " + name + " permanently?")) return;\n' +
'      fetch("/files/" + encodeURIComponent(name), { method: "DELETE" })\n' +
'        .then(function() { loadFiles(); });\n' +
'    }\n' +
'    loadFiles();\n' +
'  </script>\n' +
'</body>\n' +
'</html>';
  }

  return {
    getIndexHtml: getIndexHtml,
    getFilesHtml: getFilesHtml
  };
})();
