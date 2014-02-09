[![Build Status](https://travis-ci.org/lloyd/connect-minify.png)](https://travis-ci.org/lloyd/connect-minify)

## Usage

    var minify = require('connect-minify');

    var assets = minify({
      // assets map - maps served file identifier to a list of resources
      assets: {
        "/js/main.min.js": [
          '/js/lib/jquery.js',
          '/js/magick.js',
          '/js/laughter.js'
        ],
        "/css/home.min.css": [
          '/css/reset.css',
          '/css/home.css'
        ],
        "/css/dashboard.min.css": [
          '/css/reset.css',
          '/css/common.css',
          '/css/dashboard.css'
        ] },
      // root - where resources can be found
      root: path.join(__dirname, '..', 'static),
      // default is to minify files
      disable_minification: false
    });

    app.use(asstes.middleware);

Then later to generate a URL:

    app.use(function(req, res, next) {
      req.minifiedURL('/css/home.min.css');
    });

Or to do the same in a template:

    <head>
      <script src="<%- minifiedURL('/js/main.min.js') %>"></script>
    </head>

To use with SWIG templates, set up a custom filter:

    swig.setFilter('minifyURL', function(url){
        return assets.minifiedURL(url);
    });

Then in the SWIG template use this filter to populate a variable:

    {% set cssList = '/css/home.min.css'|minifyURL %}
    {% for css in cssList %}
    <link type="text/css" rel="stylesheet" href="{{ css }}" />
    {% endfor %}
