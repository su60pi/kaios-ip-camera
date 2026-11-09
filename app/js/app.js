// KaiOS IP Camera Main Application Controller
(function() {
  var isServerRunning = false;
  var inSettings = false;
  var inScreenSaver = false;
  var currentSettingIdx = 0;

  var cpuWakeLock = null;
  var screenWakeLock = null;

  var serverPort = 4444;
  var currentRes = "640x480";
  var currentFps = 15;
  var currentQual = 60;
  var defaultCam = "Rear";
  var audioEnabled = true;
  var authEnabled = false;
  var recordWithAudio = true;

  var previewCanvas = null;
  var previewCtx = null;
  var previewInterval = null;

  var resolutions = ["320x240", "640x480", "1280x720"];
  var frameRates = [5, 10, 15, 20, 25];
  var qualities = [30, 50, 60, 80];

  function init() {
    previewCanvas = document.getElementById('preview-canvas');
    if (previewCanvas) {
      previewCtx = previewCanvas.getContext('2d');
    }

    acquireWakeLock('screen');

    // Initialize modules
    window.AudioStreamer.init();
    window.MjpegStreamer.init();

    window.MjpegStreamer.setOnClientCountChange(function(count) {
      document.getElementById('stat-viewers').textContent = count;
    });

    detectIpAddress();
    startServer();
    startPreviewDrawing();

    window.CameraController.init({
      width: 640,
      height: 480,
      fps: currentFps,
      quality: currentQual / 100
    }).then(function() {
      startPreviewDrawing();
    }).catch(function(err) {
      console.error("Camera init error:", err);
    });

    setupKeyListeners();
    setInterval(updateTelemetry, 1500);
    updateTelemetry();
  }

  function startServer() {
    acquireWakeLock('cpu');
    window.HttpServer.start({
      port: serverPort,
      authEnabled: authEnabled,
      authUser: "admin",
      authPass: "admin"
    }).then(function(p) {
      isServerRunning = true;
      updateUiState();
    }).catch(function(err) {
      console.warn("HttpServer.start warning:", err);
      isServerRunning = true; // Set running in fallback mode
      updateUiState();
    });
  }

  function stopServer() {
    window.HttpServer.stop();
    isServerRunning = false;
    releaseWakeLock('cpu');
    updateUiState();
  }

  function toggleServer() {
    if (isServerRunning) {
      stopServer();
    } else {
      startServer();
    }
  }

  function updateUiState() {
    var dot = document.getElementById('header-dot');
    var status = document.getElementById('header-status');
    var urlEl = document.getElementById('server-url');
    var skCenter = document.getElementById('sk-center');

    if (isServerRunning) {
      dot.classList.add('active');
      status.textContent = "LIVE";
      var ip = window.HttpServer.getLocalIp() || "127.0.0.1";
      urlEl.textContent = "http://" + ip + ":" + serverPort;
      skCenter.textContent = "STOP";
    } else {
      dot.classList.remove('active');
      status.textContent = "OFFLINE";
      urlEl.textContent = "Press START to stream";
      skCenter.textContent = "START";
    }
  }

  function startPreviewDrawing() {
    if (previewInterval) clearInterval(previewInterval);
    // Draw thumbnail preview at 8 FPS to conserve KaiOS CPU
    previewInterval = setInterval(function() {
      if (inScreenSaver) return;
      var srcCanvas = window.CameraController.getCanvas();
      if (srcCanvas && previewCanvas && previewCtx) {
        var cw = previewCanvas.width;
        var ch = previewCanvas.height;
        var sw = srcCanvas.width;
        var sh = srcCanvas.height;
        if (sw > 0 && sh > 0) {
          var scale = Math.min(cw / sw, ch / sh);
          var dw = sw * scale;
          var dh = sh * scale;
          var dx = (cw - dw) / 2;
          var dy = (ch - dh) / 2;
          previewCtx.fillStyle = '#000';
          previewCtx.fillRect(0, 0, cw, ch);
          previewCtx.drawImage(srcCanvas, 0, 0, sw, sh, dx, dy, dw, dh);
        } else {
          previewCtx.drawImage(srcCanvas, 0, 0, cw, ch);
        }
      }
    }, 125);
  }

  function detectIpAddress() {
    if (navigator.mozWifiManager && navigator.mozWifiManager.connectionInformation) {
      var ci = navigator.mozWifiManager.connectionInformation;
      if (ci.ipAddress) {
        window.HttpServer.setLocalIp(ci.ipAddress);
        updateUiState();
        return;
      }
    }

    // WebRTC ICE Candidate local IP detection fallback
    try {
      var RTCPC = window.RTCPeerConnection || window.mozRTCPeerConnection;
      if (RTCPC) {
        var pc = new RTCPC({ iceServers: [] });
        pc.createDataChannel('');
        pc.createOffer().then(function(offer) { pc.setLocalDescription(offer); });
        pc.onicecandidate = function(ice) {
          if (!ice || !ice.candidate || !ice.candidate.candidate) return;
          var myIP = /([0-9]{1,3}(\.[0-9]{1,3}){3})/.exec(ice.candidate.candidate);
          if (myIP && myIP[1] && myIP[1] !== '127.0.0.1') {
            window.HttpServer.setLocalIp(myIP[1]);
            updateUiState();
            pc.close();
          }
        };
      }
    } catch (e) {}
  }

  function updateTelemetry() {
    // Battery
    if (navigator.battery) {
      var bLevel = Math.round(navigator.battery.level * 100);
      var bCharge = navigator.battery.charging ? " ⚡" : "";
      document.getElementById('stat-battery').textContent = bLevel + "%" + bCharge;
    } else if (navigator.getBattery) {
      navigator.getBattery().then(function(b) {
        document.getElementById('stat-battery').textContent = Math.round(b.level * 100) + "%" + (b.charging ? " ⚡" : "");
      });
    }

    // Wi-Fi
    if (navigator.mozWifiManager && navigator.mozWifiManager.connectionInformation) {
      var ci = navigator.mozWifiManager.connectionInformation;
      var signal = ci.relSignalStrength !== undefined ? (ci.relSignalStrength + "%") : "OK";
      document.getElementById('stat-wifi').textContent = signal;
    } else {
      document.getElementById('stat-wifi').textContent = "Wi-Fi";
    }

    // Camera stats
    var stats = window.CameraController.getStats();
    document.getElementById('vf-cam').textContent = stats.facing.toUpperCase();
    document.getElementById('vf-fps').textContent = stats.actualFps + " FPS";
    document.getElementById('stat-res').textContent = stats.resolution;
  }

  function acquireWakeLock(topic) {
    try {
      if (topic === 'cpu' && !cpuWakeLock) {
        if (navigator.requestWakeLock) cpuWakeLock = navigator.requestWakeLock('cpu');
        else if (navigator.b2g && navigator.b2g.requestWakeLock) cpuWakeLock = navigator.b2g.requestWakeLock('cpu');
      } else if (topic === 'screen' && !screenWakeLock) {
        if (navigator.requestWakeLock) screenWakeLock = navigator.requestWakeLock('screen');
        else if (navigator.b2g && navigator.b2g.requestWakeLock) screenWakeLock = navigator.b2g.requestWakeLock('screen');
      }
    } catch (e) {
      console.warn("Wake lock error:", e);
    }
  }

  function releaseWakeLock(topic) {
    try {
      if (topic === 'cpu' && cpuWakeLock) {
        cpuWakeLock.unlock();
        cpuWakeLock = null;
      } else if (topic === 'screen' && screenWakeLock) {
        screenWakeLock.unlock();
        screenWakeLock = null;
      }
    } catch (e) {}
  }

  function toggleScreenSaver() {
    var saver = document.getElementById('screen-saver');
    if (inScreenSaver) {
      // Wake up
      inScreenSaver = false;
      saver.classList.remove('active');
      acquireWakeLock('screen');
    } else {
      // Turn display off to save power & prevent heat while streaming
      inScreenSaver = true;
      saver.classList.add('active');
      releaseWakeLock('screen');
      // Ensure CPU remains awake for background server
      acquireWakeLock('cpu');
    }
  }

  function openSettings() {
    inSettings = true;
    document.getElementById('settings-view').classList.add('active');
    document.getElementById('sk-left').textContent = "Back";
    document.getElementById('sk-center').textContent = "Change";
    document.getElementById('sk-right').textContent = "Save";
    highlightSetting(currentSettingIdx);
  }

  function closeSettings() {
    inSettings = false;
    document.getElementById('settings-view').classList.remove('active');
    document.getElementById('sk-left').textContent = "Camera";
    document.getElementById('sk-center').textContent = isServerRunning ? "STOP" : "START";
    document.getElementById('sk-right').textContent = "Settings";
  }

  function highlightSetting(idx) {
    var items = document.querySelectorAll('.setting-item');
    items.forEach(function(el, i) {
      el.classList.toggle('focused', i === idx);
      if (i === idx) el.scrollIntoView({ block: 'nearest' });
    });
  }

  function cycleCurrentSetting() {
    var items = document.querySelectorAll('.setting-item');
    var item = items[currentSettingIdx];
    var type = item.getAttribute('data-setting');

    if (type === 'resolution') {
      var rIdx = (resolutions.indexOf(currentRes) + 1) % resolutions.length;
      currentRes = resolutions[rIdx];
      document.getElementById('set-res').textContent = currentRes;
      window.CameraController.setResolution(currentRes);
    } else if (type === 'fps') {
      var fIdx = (frameRates.indexOf(currentFps) + 1) % frameRates.length;
      currentFps = frameRates[fIdx];
      document.getElementById('set-fps').textContent = currentFps + " FPS";
      window.CameraController.setFps(currentFps);
    } else if (type === 'quality') {
      var qIdx = (qualities.indexOf(currentQual) + 1) % qualities.length;
      currentQual = qualities[qIdx];
      document.getElementById('set-qual').textContent = currentQual + "%";
      window.CameraController.setQuality(currentQual / 100);
    } else if (type === 'camera') {
      defaultCam = (defaultCam === "Rear" ? "Front" : "Rear");
      document.getElementById('set-cam').textContent = defaultCam;
      window.CameraController.setFacing(defaultCam === "Rear" ? "back" : "front");
    } else if (type === 'audio') {
      audioEnabled = !audioEnabled;
      document.getElementById('set-audio').textContent = audioEnabled ? "Enabled" : "Disabled";
    } else if (type === 'auth') {
      authEnabled = !authEnabled;
      document.getElementById('set-auth').textContent = authEnabled ? "Enabled" : "Disabled";
    }
  }

  // KaiOS Keypad Navigation Controller
  function setupKeyListeners() {
    window.addEventListener('keydown', function(e) {
      var key = e.key;
      var code = e.keyCode;

      // If in Screen Saver mode, ANY keypress wakes up the device screen
      if (inScreenSaver) {
        e.preventDefault();
        toggleScreenSaver();
        return;
      }

      // SoftLeft / Camera Switch / Back in settings
      if (key === 'SoftLeft' || code === 163 || code === 113 || key === 'F1' || key === 'Call') {
        e.preventDefault();
        if (inSettings) {
          closeSettings();
        } else {
          window.CameraController.toggleCamera();
          updateTelemetry();
        }
        return;
      }

      // SoftRight / Settings Toggle
      if (key === 'SoftRight' || code === 164 || code === 114 || key === 'F2') {
        e.preventDefault();
        if (inSettings) {
          closeSettings();
        } else {
          openSettings();
        }
        return;
      }

      // Center Key / Enter
      if (key === 'Enter' || code === 13) {
        e.preventDefault();
        if (inSettings) {
          cycleCurrentSetting();
        } else {
          toggleServer();
        }
        return;
      }

      // Back / Backspace
      if (key === 'Backspace' || key === 'BrowserBack' || code === 8) {
        if (inSettings) {
          e.preventDefault();
          closeSettings();
          return;
        }
      }

      // Arrow Up / Down
      if (key === 'ArrowUp' || code === 38) {
        e.preventDefault();
        if (inSettings) {
          var items = document.querySelectorAll('.setting-item');
          currentSettingIdx = (currentSettingIdx - 1 + items.length) % items.length;
          highlightSetting(currentSettingIdx);
        } else {
          // Digital Zoom In
          var s = window.CameraController.getStats();
          window.CameraController.setZoom(Math.min(4.0, s.zoom + 0.5));
        }
        return;
      }

      if (key === 'ArrowDown' || code === 40) {
        e.preventDefault();
        if (inSettings) {
          var items = document.querySelectorAll('.setting-item');
          currentSettingIdx = (currentSettingIdx + 1) % items.length;
          highlightSetting(currentSettingIdx);
        } else {
          // Digital Zoom Out
          var s = window.CameraController.getStats();
          window.CameraController.setZoom(Math.max(1.0, s.zoom - 0.5));
        }
        return;
      }

      // Keypad Shortcuts
      if (key === '1') {
        // Turn screen off for 24/7 background streaming
        e.preventDefault();
        toggleScreenSaver();
      } else if (key === '2') {
        // Toggle Flashlight / Torch
        e.preventDefault();
        window.CameraController.setTorch('toggle');
      } else if (key === '3') {
        // Snap photo to storage
        e.preventDefault();
        var blob = window.CameraController.getLatestFrameBlob();
        if (blob && navigator.getDeviceStorage) {
          var storage = navigator.getDeviceStorage('pictures') || navigator.getDeviceStorage('sdcard');
          if (storage) {
            var snapName = "snap_" + Date.now() + ".jpg";
            storage.addNamed(blob, "pictures/" + snapName);
            alert("Snapshot saved: " + snapName);
          }
        }
      } else if (key === '4') {
        // Lower resolution
        e.preventDefault();
        var idx = Math.max(0, resolutions.indexOf(currentRes) - 1);
        currentRes = resolutions[idx];
        window.CameraController.setResolution(currentRes);
        updateTelemetry();
      } else if (key === '6') {
        // Higher resolution
        e.preventDefault();
        var idx = Math.min(resolutions.length - 1, resolutions.indexOf(currentRes) + 1);
        currentRes = resolutions[idx];
        window.CameraController.setResolution(currentRes);
        updateTelemetry();
      }
    });
  }

  window.addEventListener('DOMContentLoaded', init);
})();
