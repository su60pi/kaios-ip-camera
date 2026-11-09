// KaiOS HTTP Server using mozTCPSocket
window.HttpServer = (function() {
  var serverSocket = null;
  var isRunning = false;
  var port = 4444;
  var authEnabled = false;
  var authUser = "admin";
  var authPass = "admin";
  var serverStartTime = 0;
  var localIp = "127.0.0.1";
  var streamingActive = true;

  function start(options) {
    options = options || {};
    port = options.port || 4444;
    authEnabled = options.authEnabled || false;
    authUser = options.authUser || "admin";
    authPass = options.authPass || "admin";

    if (!navigator.mozTCPSocket) {
      console.warn("navigator.mozTCPSocket not available on this platform.");
      return Promise.reject(new Error("mozTCPSocket API not supported"));
    }

    try {
      serverSocket = navigator.mozTCPSocket.listen(port, { binaryType: 'string' });
      isRunning = true;
      serverStartTime = Date.now();

      function onConnectHandler(event) {
        var clientSocket = (event && event.socket) ? event.socket : event;
        handleConnection(clientSocket);
      }

      serverSocket.onconnect = onConnectHandler;

      serverSocket.onerror = function(err) {
        console.error("HTTP Server socket error:", err);
      };

      updateLocalIp();
      return Promise.resolve(port);
    } catch (e) {
      return Promise.reject(e);
    }
  }

  function stop() {
    if (serverSocket) {
      try {
        serverSocket.close();
      } catch (e) {}
      serverSocket = null;
    }
    isRunning = false;
  }

  function handleConnection(socket) {
    if (!socket) return;

    var rawChunks = [];
    var totalBytes = 0;
    var headersParsed = false;
    var request = null;
    var headerEndOffset = -1;
    var contentLength = 0;
    var requestDispatched = false;

    // Inactivity timeout: close socket if no complete request within 5 seconds
    var connTimer = setTimeout(function() {
      if (!requestDispatched) {
        try { socket.close(); } catch (e) {}
      }
    }, 5000);

    function cleanup() {
      if (connTimer) {
        clearTimeout(connTimer);
        connTimer = null;
      }
    }

    socket.onerror = cleanup;
    socket.onclose = cleanup;

    function onData(event) {
      if (requestDispatched) return;
      var raw = (event && event.data !== undefined) ? event.data : event;
      if (!raw) return;

      var u8;
      if (typeof raw === 'string') {
        u8 = new Uint8Array(raw.length);
        for (var i = 0; i < raw.length; i++) {
          u8[i] = raw.charCodeAt(i) & 0xff;
        }
      } else if (raw instanceof ArrayBuffer) {
        u8 = new Uint8Array(raw);
      } else if (raw && raw.buffer instanceof ArrayBuffer) {
        u8 = new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength);
      } else {
        return;
      }

      // Detect TLS ClientHello (0x16 = 22) - browser attempting HTTPS
      // Close immediately so it does not hang the socket pool
      if (totalBytes === 0 && u8.length > 0 && u8[0] === 22) {
        cleanup();
        try { socket.close(); } catch (e) {}
        return;
      }

      rawChunks.push(u8);
      totalBytes += u8.length;

      // Drop connection if headers exceed 16KB without finding end
      if (!headersParsed && totalBytes > 16384) {
        cleanup();
        try { socket.close(); } catch (e) {}
        return;
      }

      var fullBuf = concatChunks(rawChunks, totalBytes);

      if (!headersParsed) {
        var endInfo = findHeaderEnd(fullBuf);
        if (endInfo !== null) {
          headersParsed = true;
          headerEndOffset = endInfo.index + endInfo.length;
          var headerBytes = fullBuf.subarray(0, endInfo.index);
          var headerText = bufferToString(headerBytes);
          request = parseHttpRequest(headerText);
          contentLength = request.headers['content-length'] ? parseInt(request.headers['content-length'], 10) : 0;

          var bodyBytesAvailable = totalBytes - headerEndOffset;
          if (bodyBytesAvailable >= contentLength) {
            request.body = fullBuf.subarray(headerEndOffset, headerEndOffset + contentLength).buffer;
            requestDispatched = true;
            cleanup();
            try {
              dispatchRequest(socket, request);
            } catch (err) {
              console.error("dispatchRequest error:", err);
              sendResponseAndClose(socket, 500, 'Internal Server Error', { 'Content-Type': 'text/plain' }, 'Server error');
            }
          }
        }
      } else {
        var bodyBytesAvailable = totalBytes - headerEndOffset;
        if (bodyBytesAvailable >= contentLength) {
          request.body = fullBuf.subarray(headerEndOffset, headerEndOffset + contentLength).buffer;
          requestDispatched = true;
          cleanup();
          try {
            dispatchRequest(socket, request);
          } catch (err) {
            console.error("dispatchRequest error:", err);
            sendResponseAndClose(socket, 500, 'Internal Server Error', { 'Content-Type': 'text/plain' }, 'Server error');
          }
        }
      }
    }

    socket.ondata = onData;
  }

  function concatChunks(chunks, total) {
    if (chunks.length === 1) return chunks[0];
    var out = new Uint8Array(total);
    var offset = 0;
    for (var i = 0; i < chunks.length; i++) {
      out.set(chunks[i], offset);
      offset += chunks[i].length;
    }
    return out;
  }

  function dispatchRequest(socket, req) {
    if (req.headers && req.headers['host']) {
      var hParts = req.headers['host'].split(':');
      if (hParts[0] && hParts[0] !== 'localhost' && hParts[0] !== '127.0.0.1') {
        localIp = hParts[0];
      }
    }

    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      sendResponseAndClose(socket, 204, 'No Content', {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      }, '');
      return;
    }

    // Handle favicon quickly to avoid browser errors
    if (req.path === '/favicon.ico') {
      sendResponseAndClose(socket, 204, 'No Content', {}, '');
      return;
    }

    // Check HTTP Basic Authentication if enabled
    if (authEnabled) {
      var authHeader = req.headers['authorization'];
      var authorized = false;
      if (authHeader && authHeader.indexOf('Basic ') === 0) {
        try {
          var creds = atob(authHeader.substring(6)).split(':');
          if (creds[0] === authUser && creds[1] === authPass) {
            authorized = true;
          }
        } catch (e) {}
      }

      if (!authorized) {
        sendResponseAndClose(socket, 401, 'Unauthorized', {
          'WWW-Authenticate': 'Basic realm="KaiOS IP Camera"',
          'Content-Type': 'text/plain; charset=utf-8'
        }, '401 Unauthorized');
        return;
      }
    }

    // Process query parameters for remote control commands
    applyRemoteControls(req.query);

    var path = req.path;

    // Routes
    if (path === '/set' || path === '/control' || path === '/settings') {
      applyRemoteControls(req.query);
      if (req.query.set !== undefined && req.query.key) {
        var q = {};
        q[req.query.key] = req.query.set;
        applyRemoteControls(q);
      }
      var camStats = window.CameraController.getStats();
      sendResponseAndClose(socket, 200, 'OK', { 'Content-Type': 'application/json' }, JSON.stringify({
        status: 'ok',
        settings: camStats
      }));
      return;
    } else if (path === '/enabletorch') {
      window.CameraController.setTorch('on');
      sendResponseAndClose(socket, 200, 'OK', { 'Content-Type': 'application/json' }, JSON.stringify({ torch: true }));
      return;
    } else if (path === '/disabletorch') {
      window.CameraController.setTorch('off');
      sendResponseAndClose(socket, 200, 'OK', { 'Content-Type': 'application/json' }, JSON.stringify({ torch: false }));
      return;
    } else if (path === '/switchcamera') {
      window.CameraController.toggleCamera();
      sendResponseAndClose(socket, 200, 'OK', { 'Content-Type': 'application/json' }, JSON.stringify({
        camera: window.CameraController.getStats().facing
      }));
      return;
    } else if (path === '/' || path === '/index.html') {
      var html = window.WebPanel.getIndexHtml(localIp, port);
      sendResponseAndClose(socket, 200, 'OK', { 'Content-Type': 'text/html; charset=utf-8' }, html);
      return;
    } else if (path === '/video/mjpeg') {
      if (!streamingActive) {
        sendResponseAndClose(socket, 503, 'Service Unavailable', { 'Content-Type': 'application/json' }, JSON.stringify({ error: 'streaming_disabled' }));
        return;
      }
      // Socket handed over to MJPEG engine (kept alive)
      window.MjpegStreamer.addClient(socket);
    } else if (path === '/video/snapshot') {
      handleSnapshot(socket, req);
    } else if (path === '/audio' || path === '/audio.wav') {
      if (!streamingActive) {
        sendResponseAndClose(socket, 503, 'Service Unavailable', { 'Content-Type': 'application/json' }, JSON.stringify({ error: 'streaming_disabled' }));
        return;
      }
      // Socket handed over to Audio engine (kept alive)
      window.AudioStreamer.addClient(socket);
    } else if (path === '/audio/upload' && req.method === 'POST') {
      var rate = req.query.rate ? parseInt(req.query.rate, 10) : 16000;
      window.AudioStreamer.playTalkAudio(req.body, rate);
      sendResponseAndClose(socket, 200, 'OK', { 'Content-Type': 'application/json' }, JSON.stringify({ status: 'ok' }));
      return;
    } else if (path === '/info.json') {
      handleInfo(socket);
    } else if (path === '/record/start') {
      var withAudio = true;
      if (req.query && req.query.audio !== undefined) {
        withAudio = (req.query.audio === '1' || req.query.audio === 'true' || req.query.audio === 'yes');
      }
      var bRate = (req.query && (req.query.bitrate || req.query.recBitrate || req.query.quality))
        ? parseInt(req.query.bitrate || req.query.recBitrate || req.query.quality, 10)
        : (window.Recorder ? window.Recorder.getBitrate() : 350000);
      window.Recorder.startRecording({ audio: withAudio, videoBitrate: bRate })
        .then(function(res) {
          sendResponseAndClose(socket, 201, 'Created', { 'Content-Type': 'application/json' }, JSON.stringify(res));
        })
        .catch(function(err) {
          sendResponseAndClose(socket, 500, 'Internal Server Error', { 'Content-Type': 'application/json' }, JSON.stringify({ error: err.message }));
        });
      return;
    } else if (path === '/record/stop') {
      window.Recorder.stopRecording()
        .then(function(res) {
          sendResponseAndClose(socket, 200, 'OK', { 'Content-Type': 'application/json' }, JSON.stringify(res));
        })
        .catch(function(err) {
          sendResponseAndClose(socket, 500, 'Internal Server Error', { 'Content-Type': 'application/json' }, JSON.stringify({ error: err.message }));
        });
    } else if (path === '/record/status') {
      sendResponseAndClose(socket, 200, 'OK', { 'Content-Type': 'application/json' }, JSON.stringify(window.Recorder.getStatus()));
    } else if (path === '/files') {
      var filesHtml = window.WebPanel.getFilesHtml();
      sendResponseAndClose(socket, 200, 'OK', { 'Content-Type': 'text/html; charset=utf-8' }, filesHtml);
    } else if (path === '/files.json') {
      window.Recorder.listFiles().then(function(files) {
        sendResponseAndClose(socket, 200, 'OK', { 'Content-Type': 'application/json' }, JSON.stringify({
          folder: 'videos',
          files: files
        }));
      });
    } else if (path.indexOf('/files/') === 0) {
      handleFileDownloadOrDelete(socket, req);
    } else if (path === '/control/start') {
      streamingActive = true;
      sendResponseAndClose(socket, 200, 'OK', { 'Content-Type': 'application/json' }, JSON.stringify({ streaming: true }));
    } else if (path === '/control/stop') {
      streamingActive = false;
      sendResponseAndClose(socket, 200, 'OK', { 'Content-Type': 'application/json' }, JSON.stringify({ streaming: false }));
    } else if (path === '/control/status') {
      sendResponseAndClose(socket, 200, 'OK', { 'Content-Type': 'application/json' }, JSON.stringify({ streaming: streamingActive }));
    } else {
      sendResponseAndClose(socket, 404, 'Not Found', { 'Content-Type': 'text/plain' }, '404 Not Found');
    }
  }

  function handleSnapshot(socket, req) {
    if (req.query.camera) {
      window.CameraController.setFacing(req.query.camera);
    }
    var buffer = window.CameraController.getLatestFrameBuffer();
    if (buffer) {
      sendResponseAndClose(socket, 200, 'OK', {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'no-cache'
      }, buffer);
    } else {
      sendResponseAndClose(socket, 503, 'Service Unavailable', { 'Content-Type': 'text/plain' }, 'No frame available yet');
    }
  }

  function handleInfo(socket) {
    var camStats = window.CameraController.getStats();
    var recStatus = window.Recorder.getStatus();
    var batteryLevel = 100;
    var isCharging = false;

    if (navigator.battery) {
      batteryLevel = Math.round(navigator.battery.level * 100);
      isCharging = navigator.battery.charging;
    }

    var wifiInfo = { ssid: 'Wi-Fi', signal: 100 };
    if (navigator.mozWifiManager && navigator.mozWifiManager.connectionInformation) {
      var ci = navigator.mozWifiManager.connectionInformation;
      wifiInfo.signal = ci.relSignalStrength !== undefined ? ci.relSignalStrength : 100;
      wifiInfo.ip = ci.ipAddress || localIp;
    }

    var info = {
      status: streamingActive ? "streaming" : "paused",
      ip: localIp,
      port: port,
      uptime: Math.round((Date.now() - serverStartTime) / 1000),
      battery: batteryLevel,
      charging: isCharging,
      wifi: wifiInfo,
      camera: camStats.facing,
      resolution: camStats.resolution,
      fps: camStats.actualFps,
      targetFps: camStats.targetFps,
      quality: camStats.quality,
      zoom: camStats.zoom,
      exposure: camStats.exposure,
      contrast: camStats.contrast,
      rotation: camStats.rotation,
      mirror: camStats.mirror,
      torch: camStats.torch,
      clients: window.MjpegStreamer.getClientCount(),
      recording: recStatus.recording,
      recordingWithAudio: recStatus.withAudio,
      recordBitrate: recStatus.bitrate || (window.Recorder ? window.Recorder.getBitrate() : 350000),
      recordDurationMs: recStatus.durationMs,
      supportedResolutions: ["320x240", "640x480", "1280x720"]
    };

    sendResponseAndClose(socket, 200, 'OK', { 'Content-Type': 'application/json' }, JSON.stringify(info));
  }

  function handleFileDownloadOrDelete(socket, req) {
    var filename = decodeURIComponent(req.path.replace('/files/', ''));
    if (req.method === 'DELETE') {
      window.Recorder.deleteFile(filename)
        .then(function() {
          sendResponseAndClose(socket, 200, 'OK', { 'Content-Type': 'application/json' }, JSON.stringify({ deleted: true }));
        })
        .catch(function(err) {
          sendResponseAndClose(socket, 404, 'Not Found', { 'Content-Type': 'application/json' }, JSON.stringify({ error: err.message }));
        });
    } else {
      // Download
      window.Recorder.getFile(filename)
        .then(function(file) {
          var reader = new FileReader();
          reader.onloadend = function() {
            var fileBuf = reader.result;
            sendResponseAndClose(socket, 200, 'OK', {
              'Content-Type': file.type || 'video/webm',
              'Content-Disposition': 'attachment; filename="' + filename + '"'
            }, fileBuf);
          };
          reader.readAsArrayBuffer(file);
        })
        .catch(function(err) {
          sendResponseAndClose(socket, 404, 'Not Found', { 'Content-Type': 'text/plain' }, 'File not found');
        });
    }
  }

  function applyRemoteControls(query) {
    if (!query) return;
    if (query.camera) window.CameraController.setFacing(query.camera);
    if (query.torch) window.CameraController.setTorch(query.torch);
    if (query.zoom) window.CameraController.setZoom(query.zoom);
    if (query.resolution) window.CameraController.setResolution(query.resolution);
    if (query.fps) window.CameraController.setFps(query.fps);
    if (query.quality) window.CameraController.setQuality(query.quality);
    if (query.exposure) window.CameraController.setExposure(query.exposure);
    if (query.contrast) window.CameraController.setContrast(query.contrast);
    if (query.rotate !== undefined) window.CameraController.setRotation(query.rotate);
    if (query.mirror !== undefined) window.CameraController.setMirror(query.mirror);
    if (query.recBitrate || query.recordBitrate) {
      if (window.Recorder && window.Recorder.setBitrate) {
        window.Recorder.setBitrate(query.recBitrate || query.recordBitrate);
      }
    }
  }

  function parseHttpRequest(headerStr) {
    var lines = headerStr.split('\r\n');
    var reqLine = lines[0].split(' ');
    var method = reqLine[0] || 'GET';
    var fullUrl = reqLine[1] || '/';
    var urlParts = fullUrl.split('?');
    var path = urlParts[0];
    var queryString = urlParts[1] || '';

    var query = {};
    if (queryString) {
      var pairs = queryString.split('&');
      for (var i = 0; i < pairs.length; i++) {
        var p = pairs[i].split('=');
        query[decodeURIComponent(p[0])] = decodeURIComponent(p[1] || '');
      }
    }

    var headers = {};
    for (var j = 1; j < lines.length; j++) {
      var colon = lines[j].indexOf(':');
      if (colon !== -1) {
        var k = lines[j].substring(0, colon).trim().toLowerCase();
        var v = lines[j].substring(colon + 1).trim();
        headers[k] = v;
      }
    }

    return {
      method: method,
      path: path,
      query: query,
      headers: headers
    };
  }

  function sendRaw(socket, data) {
    if (!socket || socket.readyState === 'closed') return false;
    try {
      if (data && data.buffer instanceof ArrayBuffer && !(data instanceof ArrayBuffer)) {
        return socket.send(data.buffer, data.byteOffset, data.byteLength);
      }
      return socket.send(data);
    } catch (e1) {
      if (typeof data === 'string') {
        try {
          return socket.send(stringToBuffer(data));
        } catch (e2) {
          return false;
        }
      }
      return false;
    }
  }

  function sendResponseAndClose(socket, statusCode, statusText, headers, body) {
    if (!socket || socket.readyState === 'closed') return;
    headers = headers || {};
    headers['Access-Control-Allow-Origin'] = '*';
    headers['Access-Control-Allow-Methods'] = 'GET, POST, DELETE, OPTIONS';
    headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization';
    headers['Connection'] = 'close';

    var bodyBuf;
    if (typeof body === 'string') {
      bodyBuf = stringToBuffer(body);
    } else if (body instanceof ArrayBuffer) {
      bodyBuf = body;
    } else if (body && body.buffer instanceof ArrayBuffer) {
      bodyBuf = body.buffer;
    } else {
      bodyBuf = new ArrayBuffer(0);
    }

    if (headers['Content-Length'] === undefined) {
      headers['Content-Length'] = bodyBuf.byteLength;
    }

    var headerStr = 'HTTP/1.1 ' + statusCode + ' ' + statusText + '\r\n';
    for (var k in headers) {
      headerStr += k + ': ' + headers[k] + '\r\n';
    }
    headerStr += '\r\n';

    var hSent = sendRaw(socket, headerStr);
    var bSent = true;
    if (bodyBuf.byteLength > 0) {
      bSent = sendRaw(socket, bodyBuf);
    }

    var closed = false;
    var closeTimer = null;
    function safeClose() {
      if (closed) return;
      closed = true;
      if (closeTimer) {
        clearTimeout(closeTimer);
        closeTimer = null;
      }
      try {
        if (socket && socket.readyState !== 'closed') {
          socket.close();
        }
      } catch (e) {}
    }

    socket.onerror = safeClose;
    socket.onclose = safeClose;

    if (bSent === false || hSent === false) {
      socket.ondrain = function() {
        setTimeout(safeClose, 100);
      };
      var fallbackMs = Math.max(2000, Math.min(60000, Math.round(bodyBuf.byteLength / 50)));
      closeTimer = setTimeout(safeClose, fallbackMs);
    } else {
      closeTimer = setTimeout(safeClose, 250);
    }
  }

  function sendResponse(socket, statusCode, statusText, headers, body) {
    sendResponseAndClose(socket, statusCode, statusText, headers, body);
  }

  function sendBinaryResponse(socket, statusCode, statusText, headers, arrayBuffer) {
    sendResponseAndClose(socket, statusCode, statusText, headers, arrayBuffer);
  }

  function updateLocalIp() {
    if (navigator.mozWifiManager && navigator.mozWifiManager.connectionInformation) {
      var ip = navigator.mozWifiManager.connectionInformation.ipAddress;
      if (ip) localIp = ip;
    }
  }

  function concatBuffers(bufs, totalLen) {
    var out = new Uint8Array(totalLen);
    var offset = 0;
    for (var i = 0; i < bufs.length; i++) {
      out.set(new Uint8Array(bufs[i]), offset);
      offset += bufs[i].byteLength;
    }
    return out.buffer;
  }

  function findHeaderEnd(buf) {
    var bytes = new Uint8Array(buf);
    for (var i = 0; i < bytes.length - 1; i++) {
      if (i < bytes.length - 3 && bytes[i] === 13 && bytes[i+1] === 10 && bytes[i+2] === 13 && bytes[i+3] === 10) {
        return { index: i, length: 4 };
      }
      if (bytes[i] === 10 && bytes[i+1] === 10) {
        return { index: i, length: 2 };
      }
    }
    return null;
  }

  function bufferToString(uint8) {
    var str = '';
    for (var i = 0; i < uint8.length; i++) {
      str += String.fromCharCode(uint8[i]);
    }
    return str;
  }

  function stringToBuffer(str) {
    if (typeof TextEncoder !== 'undefined') {
      return new TextEncoder().encode(str).buffer;
    }
    var utf8 = unescape(encodeURIComponent(str));
    var buf = new ArrayBuffer(utf8.length);
    var view = new Uint8Array(buf);
    for (var i = 0; i < utf8.length; i++) {
      view[i] = utf8.charCodeAt(i);
    }
    return buf;
  }

  return {
    start: start,
    stop: stop,
    isRunning: function() { return isRunning; },
    getPort: function() { return port; },
    getLocalIp: function() { return localIp; },
    setLocalIp: function(ip) { localIp = ip; }
  };
})();
