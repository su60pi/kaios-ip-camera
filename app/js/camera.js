// KaiOS Camera Controller
window.CameraController = (function() {
  var videoElement = null;
  var canvasElement = null;
  var ctx = null;
  var stream = null;
  var videoTrack = null;

  var currentFacing = 'environment'; // 'environment' (back) or 'user' (front)
  var width = 640;
  var height = 480;
  var targetFps = 15;
  var quality = 0.60;
  var zoom = 1.0;
  var exposure = 0.0;
  var contrast = 100;
  var rotation = 0;
  var mirror = false;
  var torchEnabled = false;

  var latestFrameBlob = null;
  var latestFrameBuffer = null;
  var isCapturing = false;
  var isEncoding = false;
  var frameIntervalId = null;
  var sharedFileReader = null;
  var idleFrameSkip = 0;

  var onFrameCallbacks = [];
  var actualFps = 0;
  var frameCounter = 0;
  var lastFpsCalculation = Date.now();

  function loadSettings() {
    try {
      var raw = localStorage.getItem('kaios_ipcam_settings');
      if (raw) {
        var s = JSON.parse(raw);
        if (s.facing) currentFacing = s.facing;
        if (s.width) width = s.width;
        if (s.height) height = s.height;
        if (s.targetFps) targetFps = s.targetFps;
        if (s.quality !== undefined) quality = s.quality;
        if (s.zoom !== undefined) zoom = s.zoom;
        if (s.exposure !== undefined) exposure = s.exposure;
        if (s.contrast !== undefined) contrast = s.contrast;
        if (s.rotation !== undefined) rotation = s.rotation;
        if (s.mirror !== undefined) mirror = s.mirror;
      }
    } catch (e) {
      console.warn("Failed to load settings:", e);
    }
  }

  function saveSettings() {
    try {
      var s = {
        facing: currentFacing,
        width: width,
        height: height,
        targetFps: targetFps,
        quality: quality,
        zoom: zoom,
        exposure: exposure,
        contrast: contrast,
        rotation: rotation,
        mirror: mirror
      };
      localStorage.setItem('kaios_ipcam_settings', JSON.stringify(s));
    } catch (e) {
      console.warn("Failed to save settings:", e);
    }
  }

  function init(options) {
    options = options || {};
    loadSettings();
    if (options.width) width = options.width;
    if (options.height) height = options.height;
    if (options.fps) targetFps = options.fps;
    if (options.quality !== undefined) quality = options.quality;

    videoElement = document.createElement('video');
    videoElement.setAttribute('autoplay', '');
    videoElement.setAttribute('playsinline', '');
    videoElement.setAttribute('muted', '');
    videoElement.style.display = 'none';
    document.body.appendChild(videoElement);

    canvasElement = document.createElement('canvas');
    canvasElement.width = width;
    canvasElement.height = height;
    ctx = canvasElement.getContext('2d');

    return startCamera();
  }

  function startCamera() {
    stopCamera();

    var constraints = {
      audio: false,
      video: {
        facingMode: { ideal: currentFacing },
        width: { ideal: width },
        height: { ideal: height },
        frameRate: { ideal: targetFps }
      }
    };

    var getMedia = null;
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      getMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    } else if (navigator.mozGetUserMedia) {
      getMedia = function(c) {
        return new Promise(function(resolve, reject) {
          navigator.mozGetUserMedia(c, resolve, reject);
        });
      };
    } else {
      return Promise.reject(new Error("Camera API not supported on this device."));
    }

    return getMedia(constraints)
      .catch(function(err) {
        console.warn("Retrying with simple video constraints:", err);
        return getMedia({ video: true, audio: false });
      })
      .then(function(s) {
        stream = s;
        videoTrack = s.getVideoTracks()[0];
        videoElement.srcObject = s;
        return new Promise(function(resolve) {
          var resolved = false;
          function done() {
            if (resolved) return;
            resolved = true;
            try { videoElement.play(); } catch (e) {}
            startCaptureLoop();
            resolve();
          }
          videoElement.onloadedmetadata = done;
          videoElement.oncanplay = done;
          setTimeout(done, 600);
        });
      });
  }

  function stopCamera() {
    stopCaptureLoop();
    if (stream) {
      stream.getTracks().forEach(function(t) { t.stop(); });
      stream = null;
      videoTrack = null;
    }
  }

  function startCaptureLoop() {
    if (frameIntervalId) clearInterval(frameIntervalId);
    isCapturing = true;
    var intervalMs = Math.round(1000 / targetFps);
    frameIntervalId = setInterval(captureFrame, intervalMs);
  }

  function stopCaptureLoop() {
    isCapturing = false;
    if (frameIntervalId) {
      clearInterval(frameIntervalId);
      frameIntervalId = null;
    }
  }

  function captureFrame() {
    if (!videoElement || videoElement.readyState < 2 || isEncoding) return;

    var hasClients = (window.MjpegStreamer && window.MjpegStreamer.getClientCount && window.MjpegStreamer.getClientCount() > 0);
    var hasRecording = (window.Recorder && window.Recorder.getStatus && window.Recorder.getStatus().recording);
    if (!hasClients && !hasRecording) {
      idleFrameSkip++;
      if (idleFrameSkip % Math.max(1, targetFps) !== 0) {
        return;
      }
    }

    isEncoding = true;

    var cw = width;
    var ch = height;
    if (rotation === 90 || rotation === 270) {
      cw = height;
      ch = width;
    }
    if (canvasElement.width !== cw || canvasElement.height !== ch) {
      canvasElement.width = cw;
      canvasElement.height = ch;
    }

    ctx.save();
    ctx.clearRect(0, 0, cw, ch);

    // Apply rotation & mirror transforms
    ctx.translate(cw / 2, ch / 2);
    if (rotation !== 0) {
      ctx.rotate((rotation * Math.PI) / 180);
    }
    if (mirror) {
      ctx.scale(-1, 1);
    }

    // Apply exposure and contrast filter if supported
    var brightnessPercent = Math.round(100 + exposure * 30);
    var filterStr = 'brightness(' + brightnessPercent + '%) contrast(' + contrast + '%)';
    if (ctx.filter !== undefined) {
      ctx.filter = filterStr;
    }

    // Apply digital zoom
    var vw = videoElement.videoWidth || width;
    var vh = videoElement.videoHeight || height;
    var cropW = vw / zoom;
    var cropH = vh / zoom;
    var cropX = (vw - cropW) / 2;
    var cropY = (vh - cropH) / 2;

    var drawW = (rotation === 90 || rotation === 270) ? height : width;
    var drawH = (rotation === 90 || rotation === 270) ? width : height;

    ctx.drawImage(videoElement, cropX, cropY, cropW, cropH, -drawW / 2, -drawH / 2, drawW, drawH);
    ctx.restore();

    // FPS calculation
    frameCounter++;
    var now = Date.now();
    if (now - lastFpsCalculation >= 1000) {
      actualFps = frameCounter;
      frameCounter = 0;
      lastFpsCalculation = now;
    }

    // Export frame to JPEG
    if (canvasElement.toBlob) {
      canvasElement.toBlob(function(blob) {
        if (!blob) {
          isEncoding = false;
          return;
        }
        latestFrameBlob = blob;
        if (!sharedFileReader) {
          sharedFileReader = new FileReader();
          sharedFileReader.onloadend = function() {
            latestFrameBuffer = sharedFileReader.result;
            isEncoding = false;
            notifyFrameListeners(latestFrameBuffer, latestFrameBlob);
          };
          sharedFileReader.onerror = function() {
            isEncoding = false;
          };
        }
        try {
          sharedFileReader.readAsArrayBuffer(blob);
        } catch (e) {
          isEncoding = false;
        }
      }, 'image/jpeg', quality);
    } else {
      // Fallback using toDataURL
      try {
        var dataUrl = canvasElement.toDataURL('image/jpeg', quality);
        var binary = atob(dataUrl.split(',')[1]);
        var buf = new ArrayBuffer(binary.length);
        var view = new Uint8Array(buf);
        for (var i = 0; i < binary.length; i++) {
          view[i] = binary.charCodeAt(i);
        }
        latestFrameBuffer = buf;
        latestFrameBlob = new Blob([buf], { type: 'image/jpeg' });
        isEncoding = false;
        notifyFrameListeners(latestFrameBuffer, latestFrameBlob);
      } catch (err) {
        isEncoding = false;
      }
    }
  }

  function notifyFrameListeners(buffer, blob) {
    for (var i = 0; i < onFrameCallbacks.length; i++) {
      try {
        onFrameCallbacks[i](buffer, blob);
      } catch (e) {
        console.error("Frame listener error:", e);
      }
    }
  }

  function addFrameListener(cb) {
    if (onFrameCallbacks.indexOf(cb) === -1) {
      onFrameCallbacks.push(cb);
    }
  }

  function removeFrameListener(cb) {
    var idx = onFrameCallbacks.indexOf(cb);
    if (idx !== -1) {
      onFrameCallbacks.splice(idx, 1);
    }
  }

  function toggleCamera() {
    currentFacing = (currentFacing === 'environment' ? 'user' : 'environment');
    return startCamera();
  }

  function setFacing(facing) {
    if (facing === 'front') currentFacing = 'user';
    else if (facing === 'back') currentFacing = 'environment';
    else if (facing === 'toggle') return toggleCamera();
    saveSettings();
    return startCamera();
  }

  function setResolution(resStr) {
    var parts = resStr.toLowerCase().split('x');
    if (parts.length === 2) {
      width = parseInt(parts[0], 10);
      height = parseInt(parts[1], 10);
    } else if (resStr === 'low') {
      width = 320; height = 240;
    } else if (resStr === 'medium' || resStr === 'auto') {
      width = 640; height = 480;
    } else if (resStr === 'high' || resStr === 'max') {
      width = 1280; height = 720;
    }
    saveSettings();
    return startCamera();
  }

  function setFps(fps) {
    targetFps = Math.max(1, Math.min(30, parseInt(fps, 10)));
    saveSettings();
    startCaptureLoop();
  }

  function setQuality(q) {
    quality = Math.max(0.1, Math.min(1.0, parseFloat(q)));
    saveSettings();
  }

  function setZoom(z) {
    zoom = Math.max(1.0, Math.min(4.0, parseFloat(z)));
    saveSettings();
  }

  function setExposure(exp) {
    exposure = Math.max(-2.0, Math.min(2.0, parseFloat(exp)));
    saveSettings();
  }

  function setContrast(con) {
    contrast = Math.max(50, Math.min(150, parseInt(con, 10)));
    saveSettings();
  }

  function setRotation(rot) {
    rotation = parseInt(rot, 10) % 360;
    saveSettings();
  }

  function setMirror(m) {
    mirror = (m === true || m === 'true' || m === '1');
    saveSettings();
  }

  function setTorch(state) {
    if (state === 'toggle') {
      torchEnabled = !torchEnabled;
    } else {
      torchEnabled = (state === 'on' || state === true || state === 'true');
    }

    // Official KaiOS FlashlightManager API (does not conflict with active camera)
    if (navigator.getFlashlightManager) {
      try {
        navigator.getFlashlightManager().then(function(fm) {
          if (fm) {
            fm.flashlightEnabled = torchEnabled;
          }
        }).catch(function(err) {
          console.warn("FlashlightManager error:", err);
        });
      } catch (e1) {}
    }

    // mozSettings API fallback
    if (navigator.mozSettings) {
      try {
        navigator.mozSettings.createLock().set({
          'flashlight.enabled': torchEnabled
        });
      } catch (e2) {}
    }

    return torchEnabled;
  }

  return {
    init: init,
    startCamera: startCamera,
    stopCamera: stopCamera,
    toggleCamera: toggleCamera,
    setFacing: setFacing,
    setResolution: setResolution,
    setFps: setFps,
    setQuality: setQuality,
    setZoom: setZoom,
    setExposure: setExposure,
    setContrast: setContrast,
    setRotation: setRotation,
    setMirror: setMirror,
    setTorch: setTorch,
    addFrameListener: addFrameListener,
    removeFrameListener: removeFrameListener,
    getLatestFrameBuffer: function() { return latestFrameBuffer; },
    getLatestFrameBlob: function() { return latestFrameBlob; },
    getCanvas: function() { return canvasElement; },
    getStream: function() { return stream; },
    getStats: function() {
      return {
        facing: currentFacing === 'user' ? 'front' : 'back',
        resolution: width + 'x' + height,
        width: width,
        height: height,
        targetFps: targetFps,
        actualFps: actualFps,
        quality: quality,
        zoom: zoom,
        exposure: exposure,
        contrast: contrast,
        rotation: rotation,
        mirror: mirror,
        torch: torchEnabled
      };
    }
  };
})();
