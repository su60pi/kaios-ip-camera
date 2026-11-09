// KaiOS Video Recording & File Storage Management
window.Recorder = (function() {
  var mediaRecorder = null;
  var recordedChunks = [];
  var isRecording = false;
  var recordingWithAudio = false;
  var recordStartTime = 0;
  var currentFilename = "";
  var currentBitrate = 350000; // 350 kbps (balanced low-size default)
  var MAX_SEGMENT_DURATION_MS = 300000; // 5-minute rolling segment limit to protect 512MB RAM
  var segmentIndex = 1;
  var isSegmentRolling = false;
  var currentStream = null;
  var currentRecorderOptions = null;
  var userStopCallback = null;
  try {
    var savedBitrate = localStorage.getItem('kaios_ipcam_rec_bitrate');
    if (savedBitrate) {
      currentBitrate = parseInt(savedBitrate, 10) || 350000;
    }
  } catch (e) {}

  function getStorage() {
    if (navigator.getDeviceStorage) {
      try {
        return navigator.getDeviceStorage('sdcard') || navigator.getDeviceStorage('videos');
      } catch (e) {}
    }
    if (navigator.b2g && navigator.b2g.getDeviceStorage) {
      try {
        return navigator.b2g.getDeviceStorage('sdcard') || navigator.b2g.getDeviceStorage('videos');
      } catch (e) {}
    }
    return null;
  }

  function startRecording(options) {
    if (isRecording) {
      return Promise.reject(new Error("Already recording"));
    }

    var withAudio = true; // Default: record with audio
    var videoBitrate = currentBitrate;
    if (typeof options === 'boolean') {
      withAudio = options;
    } else if (typeof options === 'string') {
      withAudio = (options === '1' || options === 'true' || options === 'yes');
    } else if (options && typeof options === 'object') {
      if (options.audio !== undefined) {
        withAudio = (options.audio === true || options.audio === '1' || options.audio === 'true' || options.audio === 'yes');
      }
      if (options.videoBitrate) {
        videoBitrate = parseInt(options.videoBitrate, 10) || currentBitrate;
      } else if (options.bitrate) {
        videoBitrate = parseInt(options.bitrate, 10) || currentBitrate;
      }
    }
    currentBitrate = videoBitrate;
    try { localStorage.setItem('kaios_ipcam_rec_bitrate', String(currentBitrate)); } catch (e) {}

    function prepareStream() {
      var videoStream = (window.CameraController && window.CameraController.getStream())
        ? window.CameraController.getStream()
        : null;
      if (!videoStream) {
        var canvas = window.CameraController ? window.CameraController.getCanvas() : null;
        if (canvas && canvas.captureStream) {
          try { videoStream = canvas.captureStream(15); } catch (e1) {}
        }
      }

      if (!videoStream) {
        return Promise.reject(new Error("No active camera stream to record"));
      }

      if (!withAudio) {
        recordingWithAudio = false;
        return Promise.resolve(videoStream);
      }

      // Record with audio: capture microphone track
      if (window.AudioStreamer && window.AudioStreamer.startMicCapture) {
        return window.AudioStreamer.startMicCapture().then(function() {
          var micStream = window.AudioStreamer.getMicStream();
          var audioTrack = (micStream && micStream.getAudioTracks && micStream.getAudioTracks().length > 0)
            ? micStream.getAudioTracks()[0]
            : null;

          if (!audioTrack) {
            console.warn("No audio track found, recording video only");
            recordingWithAudio = false;
            return videoStream;
          }

          var combinedStream = null;
          try {
            if (typeof MediaStream !== 'undefined') {
              combinedStream = new MediaStream();
              videoStream.getVideoTracks().forEach(function(vt) { combinedStream.addTrack(vt); });
              combinedStream.addTrack(audioTrack);
            }
          } catch (e2) {}

          if (!combinedStream) {
            try {
              combinedStream = videoStream.clone();
              combinedStream.addTrack(audioTrack);
            } catch (e3) {
              combinedStream = videoStream;
            }
          }

          recordingWithAudio = true;
          return combinedStream;
        }).catch(function(err) {
          console.warn("Failed to capture mic for recording, recording video only:", err);
          recordingWithAudio = false;
          return videoStream;
        });
      } else {
        recordingWithAudio = false;
        return Promise.resolve(videoStream);
      }
    }

    return prepareStream().then(function(streamToRecord) {
      var mimeType = 'video/webm';
      if (window.MediaRecorder && MediaRecorder.isTypeSupported) {
        if (recordingWithAudio && MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')) {
          mimeType = 'video/webm;codecs=vp8,opus';
        } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8')) {
          mimeType = 'video/webm;codecs=vp8';
        } else if (MediaRecorder.isTypeSupported('video/mp4')) {
          mimeType = 'video/mp4';
        }
      }

      var recorderOptions = {
        mimeType: mimeType,
        videoBitsPerSecond: videoBitrate,
        audioBitsPerSecond: 32000
      };

      segmentIndex = 1;
      isSegmentRolling = false;
      currentStream = streamToRecord;
      currentRecorderOptions = recorderOptions;
      recordedChunks = [];
      var audioSuffix = recordingWithAudio ? "_audio" : "_noaudio";
      var ext = (mimeType.indexOf('mp4') !== -1 ? ".mp4" : ".webm");
      currentFilename = "rec_" + formatDate(new Date()) + "_p" + segmentIndex + audioSuffix + ext;
      recordStartTime = Date.now();

      setupMediaRecorderInstance(currentStream, currentRecorderOptions);
      mediaRecorder.start(1000); // 1-sec chunking
      isRecording = true;

      return {
        recording: true,
        withAudio: recordingWithAudio,
        bitrate: currentBitrate,
        filename: currentFilename,
        startTime: recordStartTime
      };
    });
  }

  function setupMediaRecorderInstance(stream, options) {
    try {
      mediaRecorder = new MediaRecorder(stream, options);
    } catch (e1) {
      try {
        mediaRecorder = new MediaRecorder(stream, { mimeType: options.mimeType });
      } catch (e2) {
        mediaRecorder = new MediaRecorder(stream);
      }
    }

    mediaRecorder.ondataavailable = function(e) {
      if (e.data && e.data.size > 0) {
        recordedChunks.push(e.data);
      }
      // Check segment limit (5 minutes) to prevent memory accumulation and OOM
      if (isRecording && !isSegmentRolling && (Date.now() - recordStartTime >= MAX_SEGMENT_DURATION_MS)) {
        rollNextSegment();
      }
    };

    mediaRecorder.onstop = function() {
      handleRecorderStop();
    };
  }

  function rollNextSegment() {
    if (!isRecording || isSegmentRolling || !mediaRecorder) return;
    isSegmentRolling = true;
    try {
      mediaRecorder.stop();
    } catch (e) {
      isSegmentRolling = false;
    }
  }

  function handleRecorderStop() {
    var durationMs = Date.now() - recordStartTime;
    var mime = (currentRecorderOptions && currentRecorderOptions.mimeType) || (mediaRecorder && mediaRecorder.mimeType) || 'video/webm';
    var blob = new Blob(recordedChunks, { type: mime });
    var savedName = currentFilename;
    recordedChunks = [];

    function afterSaved() {
      if (isSegmentRolling && isRecording) {
        // Roll to next 5-minute segment
        segmentIndex++;
        var audioSuffix = recordingWithAudio ? "_audio" : "_noaudio";
        var ext = (mime.indexOf('mp4') !== -1 ? ".mp4" : ".webm");
        currentFilename = "rec_" + formatDate(new Date()) + "_p" + segmentIndex + audioSuffix + ext;
        recordStartTime = Date.now();
        isSegmentRolling = false;

        setupMediaRecorderInstance(currentStream, currentRecorderOptions);
        mediaRecorder.start(1000);
        console.log("Auto-rolled recording to segment:", currentFilename);
      } else {
        // Normal stop by user
        isRecording = false;
        var wasWithAudio = recordingWithAudio;
        recordingWithAudio = false;

        if (window.AudioStreamer && window.AudioStreamer.getAudioClientCount() === 0) {
          try { window.AudioStreamer.stopMicCapture(); } catch (e) {}
        }

        if (userStopCallback) {
          var cb = userStopCallback;
          userStopCallback = null;
          cb({
            recording: false,
            withAudio: wasWithAudio,
            filename: savedName,
            durationMs: durationMs,
            sizeBytes: blob.size,
            blob: blob
          });
        }
      }
    }

    var storage = getStorage();
    if (storage) {
      var req = storage.addNamed(blob, "videos/" + savedName);
      req.onsuccess = function() { afterSaved(); };
      req.onerror = function() {
        var reqRoot = storage.addNamed(blob, savedName);
        reqRoot.onsuccess = function() { afterSaved(); };
        reqRoot.onerror = function(err) {
          console.warn("Save recording segment error:", err);
          afterSaved();
        };
      };
    } else {
      afterSaved();
    }
  }

  function stopRecording() {
    if (!mediaRecorder || mediaRecorder.state === 'inactive') {
      isRecording = false;
      recordingWithAudio = false;
      return Promise.reject(new Error("Not currently recording"));
    }

    isSegmentRolling = false;
    return new Promise(function(resolve, reject) {
      userStopCallback = resolve;
      try {
        mediaRecorder.stop();
      } catch (err) {
        isRecording = false;
        recordingWithAudio = false;
        userStopCallback = null;
        reject(err);
      }
    });
  }

  function getStatus() {
    var active = isRecording && (mediaRecorder ? mediaRecorder.state === 'recording' : false);
    return {
      recording: active,
      withAudio: recordingWithAudio,
      bitrate: currentBitrate,
      state: mediaRecorder ? mediaRecorder.state : "inactive",
      filename: active ? currentFilename : "",
      durationMs: active ? (Date.now() - recordStartTime) : 0
    };
  }

  function listFiles() {
    return new Promise(function(resolve) {
      var storage = getStorage();
      if (!storage) {
        resolve([]);
        return;
      }

      var files = [];
      var cursor = storage.enumerate("videos");

      cursor.onsuccess = function() {
        if (this.result) {
          var f = this.result;
          files.push({
            name: f.name.replace(/^videos\//, ''),
            fullName: f.name,
            sizeBytes: f.size,
            lastModifiedMs: f.lastModified ? new Date(f.lastModified).getTime() : Date.now()
          });
          this.continue();
        } else {
          resolve(files);
        }
      };

      cursor.onerror = function() {
        resolve([]);
      };
    });
  }

  function getFile(filename) {
    return new Promise(function(resolve, reject) {
      var storage = getStorage();
      if (!storage) {
        reject(new Error("No storage"));
        return;
      }
      var targetPath = filename.indexOf('/') !== -1 ? filename : ("videos/" + filename);
      var req = storage.get(targetPath);
      req.onsuccess = function() {
        resolve(this.result);
      };
      req.onerror = function(err) {
        reject(err);
      };
    });
  }

  function deleteFile(filename) {
    return new Promise(function(resolve, reject) {
      var storage = getStorage();
      if (!storage) {
        reject(new Error("No storage"));
        return;
      }
      var targetPath = filename.indexOf('/') !== -1 ? filename : ("videos/" + filename);
      var req = storage.delete(targetPath);
      req.onsuccess = function() {
        resolve(true);
      };
      req.onerror = function(err) {
        reject(err);
      };
    });
  }

  function formatDate(d) {
    function pad(n) { return (n < 10 ? '0' : '') + n; }
    return d.getFullYear() +
           pad(d.getMonth() + 1) +
           pad(d.getDate()) + "_" +
           pad(d.getHours()) +
           pad(d.getMinutes()) +
           pad(d.getSeconds());
  }

  function setBitrate(val) {
    var b = parseInt(val, 10);
    if (!isNaN(b) && b >= 100000 && b <= 5000000) {
      currentBitrate = b;
      try { localStorage.setItem('kaios_ipcam_rec_bitrate', String(b)); } catch (e) {}
    }
  }

  function getBitrate() {
    return currentBitrate;
  }

  return {
    startRecording: startRecording,
    stopRecording: stopRecording,
    getStatus: getStatus,
    setBitrate: setBitrate,
    getBitrate: getBitrate,
    isRecordingAudio: function() { return isRecording && recordingWithAudio; },
    listFiles: listFiles,
    getFile: getFile,
    deleteFile: deleteFile
  };
})();
