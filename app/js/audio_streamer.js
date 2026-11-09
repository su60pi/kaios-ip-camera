// KaiOS Audio Capture & Two-Way Speaker Controller
window.AudioStreamer = (function() {
  var audioCtx = null;
  var micStream = null;
  var micSource = null;
  var scriptProcessor = null;
  var audioClients = [];
  var isCapturing = false;
  var sampleRate = 16000;

  function init() {
    var AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) {
      audioCtx = new AudioContext();
    }
  }

  function startMicCapture() {
    if (isCapturing) return Promise.resolve();

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
      return Promise.reject(new Error("Audio API not supported"));
    }

    var audioConstraints = {
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        channelCount: 1
      },
      video: false
    };

    return getMedia(audioConstraints)
      .catch(function() {
        return getMedia({ audio: true, video: false });
      })
      .then(function(s) {
        micStream = s;
        if (!audioCtx) {
          var AudioContext = window.AudioContext || window.webkitAudioContext;
          audioCtx = new AudioContext();
        }
        if (audioCtx.state === 'suspended') {
          audioCtx.resume();
        }

        micSource = audioCtx.createMediaStreamSource(micStream);
        // ScriptProcessor with 4096 buffer size for stable capture without underruns
        scriptProcessor = audioCtx.createScriptProcessor(4096, 1, 1);

        scriptProcessor.onaudioprocess = function(e) {
          var inputData = e.inputBuffer.getChannelData(0);
          var pcm16 = floatTo16BitPCM(inputData);
          broadcastAudio(pcm16.buffer);
        };

        micSource.connect(scriptProcessor);
        // Mute local destination so the phone speaker does not create an acoustic feedback loop
        var muteGain = audioCtx.createGain();
        muteGain.gain.value = 0;
        scriptProcessor.connect(muteGain);
        muteGain.connect(audioCtx.destination);
        isCapturing = true;
      });
  }

  function stopMicCapture() {
    isCapturing = false;
    if (scriptProcessor) {
      scriptProcessor.disconnect();
      scriptProcessor = null;
    }
    if (micSource) {
      micSource.disconnect();
      micSource = null;
    }
    if (micStream) {
      micStream.getTracks().forEach(function(t) { t.stop(); });
      micStream = null;
    }
  }

  function floatTo16BitPCM(input) {
    var output = new Int16Array(input.length);
    for (var i = 0; i < input.length; i++) {
      var s = Math.max(-1, Math.min(1, input[i]));
      output[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return output;
  }

  function addClient(socket) {
    if (!socket || socket._audioAdded || audioClients.indexOf(socket) !== -1) {
      return;
    }
    socket._audioAdded = true;
    socket.ondata = null;

    startMicCapture().catch(function(err) {
      console.warn("Failed to capture mic for /audio client:", err);
    });

    var rate = audioCtx ? audioCtx.sampleRate : sampleRate;
    var wavHeader = createStreamingWavHeader(rate, 1, 16);

    var httpHeader = "HTTP/1.1 200 OK\r\n" +
                     "Server: KaiOS-IP-Camera/1.0\r\n" +
                     "Connection: close\r\n" +
                     "Content-Type: audio/wav\r\n" +
                     "Accept-Ranges: none\r\n" +
                     "Access-Control-Allow-Origin: *\r\n" +
                     "Cache-Control: no-cache, no-store, must-revalidate\r\n" +
                     "Pragma: no-cache\r\n" +
                     "\r\n";

    sendRaw(socket, httpHeader);
    sendRaw(socket, wavHeader);

    audioClients.push(socket);

    socket.onclose = function() { removeClient(socket); };
    socket.onerror = function() { removeClient(socket); };
  }

  function removeClient(socket) {
    var idx = audioClients.indexOf(socket);
    if (idx !== -1) {
      audioClients.splice(idx, 1);
    }
    if (audioClients.length === 0 && (!window.Recorder || !window.Recorder.isRecordingAudio())) {
      stopMicCapture();
    }
  }

  function broadcastAudio(buffer) {
    if (audioClients.length === 0) return;
    for (var i = audioClients.length - 1; i >= 0; i--) {
      var client = audioClients[i];
      if (!client || client.readyState === 'closed') {
        audioClients.splice(i, 1);
        try { client.close(); } catch(e) {}
        continue;
      }
      try {
        var res = sendRaw(client, buffer);
        if (res === false) {
          audioClients.splice(i, 1);
          try { client.close(); } catch(e) {}
        }
      } catch (e) {
        audioClients.splice(i, 1);
        try { client.close(); } catch(err) {}
      }
    }
    if (audioClients.length === 0 && (!window.Recorder || !window.Recorder.isRecordingAudio())) {
      stopMicCapture();
    }
  }

  function createStreamingWavHeader(sampleRate, channels, bitsPerSample) {
    var buffer = new ArrayBuffer(44);
    var view = new DataView(buffer);

    writeString(view, 0, 'RIFF');
    view.setUint32(4, 0x7FFFFFFF, true); // 2GB streaming length
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
    view.setUint16(20, 1, true); // AudioFormat (1 for PCM)
    view.setUint16(22, channels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * channels * (bitsPerSample / 8), true); // ByteRate
    view.setUint16(32, channels * (bitsPerSample / 8), true); // BlockAlign
    view.setUint16(34, bitsPerSample, true);
    writeString(view, 36, 'data');
    view.setUint32(40, 0x7FFFFFFF, true); // Subchunk2Size (2GB for streaming)

    return buffer;
  }

  function writeString(view, offset, string) {
    for (var i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
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

  // Play incoming push-to-talk audio through KaiOS phone speaker
  function playTalkAudio(pcmBuffer, targetSampleRate) {
    if (!pcmBuffer || pcmBuffer.byteLength < 4) return;

    var rate = targetSampleRate || 16000;
    var validBytes = pcmBuffer.byteLength - (pcmBuffer.byteLength % 2);
    if (validBytes <= 0) return;

    // Create standard WAV container in memory for direct KaiOS Audio hardware output
    var wavBuf = new ArrayBuffer(44 + validBytes);
    var view = new DataView(wavBuf);
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + validBytes, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, 1, true); // 1 channel
    view.setUint32(24, rate, true);
    view.setUint32(28, rate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(view, 36, 'data');
    view.setUint32(40, validBytes, true);

    new Uint8Array(wavBuf, 44).set(new Uint8Array(pcmBuffer, 0, validBytes));

    try {
      var blob = new Blob([wavBuf], { type: 'audio/wav' });
      var url = URL.createObjectURL(blob);
      var audio = new Audio();
      audio.mozAudioChannelType = 'content';
      audio.src = url;
      audio.onended = function() {
        URL.revokeObjectURL(url);
      };
      audio.onerror = function() {
        URL.revokeObjectURL(url);
      };
      var p = audio.play();
      if (p && p.catch) p.catch(function() {});
    } catch (e1) {
      try {
        if (!audioCtx) {
          var AudioContext = window.AudioContext || window.webkitAudioContext;
          audioCtx = new AudioContext();
        }
        var int16 = new Int16Array(pcmBuffer, 0, validBytes / 2);
        var ab = audioCtx.createBuffer(1, int16.length, rate);
        var cd = ab.getChannelData(0);
        for (var i = 0; i < int16.length; i++) cd[i] = int16[i] / 32768.0;
        var src = audioCtx.createBufferSource();
        src.buffer = ab;
        src.connect(audioCtx.destination);
        src.start(0);
      } catch (e2) {}
    }
  }

  function stopAllClients() {
    var copy = audioClients.slice();
    audioClients = [];
    for (var i = 0; i < copy.length; i++) {
      try {
        copy[i].close();
      } catch (e) {}
    }
    stopMicCapture();
  }

  return {
    init: init,
    startMicCapture: startMicCapture,
    stopMicCapture: stopMicCapture,
    getMicStream: function() { return micStream; },
    addClient: addClient,
    removeClient: removeClient,
    stopAllClients: stopAllClients,
    playTalkAudio: playTalkAudio,
    getAudioClientCount: function() { return audioClients.length; }
  };
})();
