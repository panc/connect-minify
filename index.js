/* Copyright 2013 Lloyd Hilaiel
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License. */

var fs = require('fs'),
path = require('path'),
util = require('util'),
_ = require('underscore'),
crypto = require('crypto'),
computecluster = require('compute-cluster'),
mime = require('mime');

var compressor = new computecluster({
  module: path.join(__dirname, 'compressor.js'),
  max_backlog: -1
});

// synchronous check for the existence of assets
function syncAssetCheck(opts) {
  // check root path
  if (typeof opts.root !== 'string') {
    throw new Error(util.format("root path malformed (expected a string)"));
  } else if (!fs.existsSync(opts.root)) {
    throw new Error(util.format("root path does not exist: %s", opts.root));
  }

  Object.keys(opts.assets).forEach(function(k) {
    // allow assets composed of a single file to be specified
    // as strings
    if (typeof opts.assets[k] === 'string') {
      opts.assets[k] = [ opts.assets[k] ];
    }
    // verify the existence of each file
    opts.assets[k].forEach(function(v) {
      if (typeof v !== 'string') {
        throw new Error(util.format("'%s' has malformed asset list", k));
      }
      if (!fs.existsSync(path.join(opts.root, v))) {
        throw new Error(util.format("'%s' file does not exist", v));
      }
    });
  });
}

function cacheUpdate(opts, done) {
  var cache = {};

  // for each key, let's read all files associated with the key
  Object.keys(opts.assets).forEach(function(k) {
    var arr = opts.assets[k].slice(0);
    var source = "";
    function next() {
      if (arr.length === 0) {
        var md5 = crypto.createHash('md5');
        md5.update(source);
        var hash = md5.digest('hex').slice(0, 10);

        cache[k] = {
          source: source,
          hash: hash
        };

        if (Object.keys(cache).length === Object.keys(opts.assets).length) {
          done(cache);
        }
        return;
      }
      var f = path.join(opts.root, arr.shift());
      fs.readFile(f, function(err, contents) {
        if (err) {
          process.exit(1);
        }
        if (source.length) source += "\n";
        source += contents;
        next();
      });
    }
    next();
  });

}

module.exports = function(opts) {
  opts = _.clone(opts);
  if (typeof opts !== 'object') {
    throw new Error("options argument to minify expected to be an object");
  } else if (!opts.hasOwnProperty('assets')) {
    throw new Error("assets argument to minify missing");
  } else if (typeof opts.assets !== 'object' || opts.assets === null) {
    throw new Error("assets argument to minify must be an object");
  }
  if (!opts.root) opts.root = process.cwd();
  if (!opts.prefix) opts.prefix = '/';

  syncAssetCheck(opts);

  var cache = null;
  var waiting = null;

  var minifiedURL = function(url) {
    if (opts.development) {
			
      var assets = opts.assets[url];
      var urls = [];
      
      assets.forEach(function (asset) {
          var url = asset;

          Object.keys(opts.map).forEach(function(m) {

              var matcher = new RegExp("^" + m);
              url = url.replace(matcher, opts.map[m]);
            });

          urls.push(url);
        });
      
      return urls;
    } else {
      if (!cache[url]) throw new Error(util.format("cannot minify url '%s'", url));
      return [util.format('%s%s%s', opts.prefix, cache[url].hash, url)];
    }
  };

  // update the cache, upon completion will wake up all requests on the waiting queue
  function startCacheUpdate() {
    cacheUpdate(opts, function(theCache) {
      cache = theCache;
      waiting.forEach(function(f) { f(); });
      waiting = null;
    });
  }

  // now build up the regular expression we'll use to determine if incoming requests are cachify urls
  function prefixToRegex(prefix) {
    if (prefix.indexOf('://') !== -1) {
      var m = prefix.match(/^[a-z]{3,5}:\/\/[a-z0-9\-_.]*(?:\:[0-9]*)?\/(.*)$/i);
      if (m) prefix = m[1];
    }
    var reStr = util.format('^%s([a-f0-9]{10})(.*)', prefix.replace('/', '\/'));
    return new RegExp(reStr);
  }

  var isMinifyUrl = prefixToRegex(opts.prefix);

  return {
    middleware: function(req, res, next) {
      var handleRequest = function() {
        var m = isMinifyUrl.exec(req.url);
        // if the hashes don't match, perhaps we should emit a warning
        if (m && m[1] && cache[m[2]] && cache[m[2]].hash === m[1]) {
          var key = m[2];
          res.setHeader('Cache-Control', 'public, max-age=31536000');
          res.setHeader('Content-Type', mime.lookup(key));

          if (!cache[key].minified) {
            // XXX: don't compress multiple times when simultaneous requests
            // come in
            compressor.enqueue({
              name: key,
              content: cache[key].source
            }, function (err, r) {
              if (err) return res.send(500, "failed to generate resource");
              delete cache[key].source;
              cache[key].minified = r.content;
              res.send(200, cache[key].minified);
            });
          } else {
            res.send(200, cache[key].minified);
          }
        } else if (m && m[1]) {
          // url is a cached url but the file has not been defined in any mapping (because file was not found in the cache)
          // => the file must be any static content like an image

          res.redirect(m[2]);
            
        } else {
          res.minifiedURL = res.locals.minifiedURL = minifiedURL;
          next();
        }
      };

      // lazy cache population
      if (!cache) {
        if (!waiting) {
          waiting = [ handleRequest ];
          startCacheUpdate();
        } else {
          waiting.push(handleRequest);
        }
      } else {
        handleRequest();
      }
    },
    minifiedURL: minifiedURL
  };
};
