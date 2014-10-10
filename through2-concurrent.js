// Like through2 except execute in parallel with a set maximum
// concurrency
var through2 = require('through2');

module.exports = function concurrentThrough (options, transform, flush) {
  var concurrent = 0, lastCallback = null, pendingFlush = null, concurrency;

  if (typeof options === 'function') {
    flush     = transform;
    transform = options;
    options   = {};
  }
  
  maxConcurrency = options.maxConcurrency || 16;

  function _transform (message, enc, callback) {           
    var callbackCalled = false;
    concurrent++;
    if (concurrent < maxConcurrency) {
      // Ask for more right away
      callback();
    } else {
      // We're at the concurrency limit, save the callback for
      // when we're ready for more
      lastCallback = callback;
    }

    transform(message, enc, function () {
      // Ignore multiple calls of the callback (shouldn't ever
      // happen, but just in case)
      if (callbackCalled) return;
      callbackCalled = true;
      concurrent--;
      if (lastCallback) {
        var cb = lastCallback;
        lastCallback = null;
        cb();
      }
      if (concurrent === 0 && pendingFlush) {
        pendingFlush();
        pendingFlush = null;
      }
    });
  }

  function _flush (callback) {
    // Ensure that flush isn't called until all transforms are complete 
    if (concurrent === 0) {
      flush(callback);
    } else {
      pendingFlush = flush.bind(this, callback);
    }
  }
  
  return through2(options, _transform, (typeof flush === 'function') ? _flush : undefined);
};

module.exports.obj = function (options, transform, flush) {
  if (typeof options === 'function') {
    flush     = transform;
    transform = options;
    options   = {};
  }

  options.objectMode = true;
  if (options.highWaterMark == null) {
    options.highWaterMark = 16;
  }
  return module.exports(options, transform, flush);
};