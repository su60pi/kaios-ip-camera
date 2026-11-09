// MJPEG Streaming Engine
window.MjpegStreamer = (function() {
  var clients = [];
  var onClientCountChange = null;

  function init() {
    window.CameraController.addFrameListener(broadcastFrame);
  }

  function addClient(socket) {
    if (!socket || socket._mjpegAdded || clients.indexOf(socket) !== -1) {
      return;
    }
    socket._mjpegAdded = true;
    socket.ondata = null;

    // Send standard MJPEG streaming multipart header
    var header = "HTTP/1.1 200 OK\r\n" +
                 "Server: KaiOS-IP-Camera/1.0\r\n" +
                 "Connection: close\r\n" +
                 "Content-Type: multipart/x-mixed-replace; boundary=frame\r\n" +
                 "Access-Control-Allow-Origin: *\r\n" +
                 "Cache-Control: no-cache, no-store, must-revalidate\r\n" +
                 "Pragma: no-cache\r\n" +
                 "Expires: 0\r\n" +
                 "\r\n";
    sendRaw(socket, header);

    socket.isMjpegClient = true;
    socket.lastSent = Date.now();
    clients.push(socket);

    socket.onclose = function() {
      removeClient(socket);
    };
    socket.onerror = function() {
      removeClient(socket);
    };

    notifyClientCount();

    // Immediately send current cached frame if available
    var currentBuf = window.CameraController.getLatestFrameBuffer();
    if (currentBuf) {
      sendFrameToClient(socket, currentBuf);
    }
  }

  function removeClient(socket) {
    var idx = clients.indexOf(socket);
    if (idx !== -1) {
      clients.splice(idx, 1);
      notifyClientCount();
    }
  }

  function broadcastFrame(frameBuffer) {
    if (!frameBuffer || clients.length === 0) return;

    var toRemove = [];
    for (var i = 0; i < clients.length; i++) {
      var client = clients[i];
      if (!client || client.readyState === 'closed') {
        toRemove.push(client);
        continue;
      }

      // Critical buffer overflow protection (> 1MB) for dead sockets
      if (client.bufferedAmount !== undefined && client.bufferedAmount > 1024 * 1024) {
        toRemove.push(client);
        try { client.close(); } catch(e) {}
        continue;
      }

      // Smooth frame-dropping: If receiver buffer has > 128KB pending, skip frame
      if (client.bufferedAmount !== undefined && client.bufferedAmount > 128 * 1024) {
        continue;
      }

      sendFrameToClient(client, frameBuffer);
    }

    for (var j = 0; j < toRemove.length; j++) {
      removeClient(toRemove[j]);
    }
  }

  function sendRaw(socket, data) {
    if (!socket || socket.readyState === 'closed') return false;
    try {
      return socket.send(data);
    } catch (e1) {
      if (typeof data === 'string') {
        try {
          var buf = new ArrayBuffer(data.length);
          var view = new Uint8Array(buf);
          for (var i = 0; i < data.length; i++) view[i] = data.charCodeAt(i) & 0xff;
          return socket.send(buf);
        } catch (e2) {
          return false;
        }
      }
      return false;
    }
  }

  function sendFrameToClient(client, buffer) {
    if (!client || client.readyState === 'closed') {
      removeClient(client);
      return;
    }
    var delimiter = "--frame\r\n" +
                    "Content-Type: image/jpeg\r\n" +
                    "Content-Length: " + buffer.byteLength + "\r\n" +
                    "X-Timestamp: " + Date.now() + "\r\n" +
                    "\r\n";
    try {
      sendRaw(client, delimiter);
      sendRaw(client, buffer);
      sendRaw(client, "\r\n");
    } catch (e) {
      removeClient(client);
      try { client.close(); } catch(err) {}
    }
  }

  function notifyClientCount() {
    if (typeof onClientCountChange === 'function') {
      onClientCountChange(clients.length);
    }
  }

  function setOnClientCountChange(cb) {
    onClientCountChange = cb;
  }

  function getClientCount() {
    return clients.length;
  }

  function stopAllClients() {
    var copy = clients.slice();
    clients = [];
    for (var i = 0; i < copy.length; i++) {
      try {
        copy[i].close();
      } catch (e) {}
    }
    notifyClientCount();
  }

  return {
    init: init,
    addClient: addClient,
    removeClient: removeClient,
    stopAllClients: stopAllClients,
    getClientCount: getClientCount,
    setOnClientCountChange: setOnClientCountChange
  };
})();
