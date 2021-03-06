[![Build Status](https://travis-ci.org/panc/connect-minify.png?branch=master)](https://travis-ci.org/panc/connect-minify)
## About the project

This project is a fork from [Lloyd's connect-minify](https://github.com/lloyd/connect-minify) project. It extends the original project by the possibility to automatically generate the html-entries for the generated and combined resource files. Furthermore it supports a debug/development mode, so that the resource files are not combined, which makes debugging much more easier.

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
		"/bower/bower.min.js": 	[
          '/bower_components/dummy.js',
          '/bower_components/laughter.js'
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
      disable_minification: false,
	  developement: true,
	  map: {
		'/bower_components/': '/bower/',
		'/public/': '/'
	  }
    });

    app.use(asstes.middleware);

Then later to generate a URL:

    app.use(function(req, res, next) {
      req.minifiedURL('/css/home.min.css');
    });

## Usage in templates
	
The same can be done within a template:

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
	
Use the 'map' property to establish a mapping between local paths and url-paths. This is only useful if the developement property is set to 'true'.
