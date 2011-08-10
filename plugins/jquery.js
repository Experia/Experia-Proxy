/*
Written by Greg Reimer
Copyright (c) 2011
http://github.com/greim
*/

/**
Manipulate the response body as DOM using jQuery.

    usage: @jquery('path/to/your/script.js')
    -or-   @jquery('my script to eval')

You provide a path to a script which you created and saved somewhere on the same
filesystem as your hoxy instance. This script will execute in the following
environment:

   * window is the top-level object
   * window.document exists and contains a fully-loaded DOM (via jsdom) of the page
   * a jQuery instance is available with which to manipulate the DOM
   * unlike in browsers, external resources (e.g. images) have not been fetched
   * unlike in browsers, <script> elements have not been executed

other notes:

   * experimental! use at own risk! report bugs! contribute!
   * non-html pages are silently ignored
   * otherwise, the response body is parsed into DOM by jsdom
   * after your code runs, the resulting DOM is re-serialized back to a string
     and sent to the client
   * path to your script resolves to dir hoxy was launched from.
   * jQuery 1.6.1 is used and ships with this plugin
*/

// declare vars, import libs, etc
var jsdomExists = true;
try { var JSDOM = require('jsdom'); }
catch (err) { jsdomExists = false; }
var PATH = require('path');
var VM = require('vm');
var FS = require('fs');
var doctypePatt = /(<!doctype[^>]*>)/i;

// make sure jsdom gives us an inert DOM
JSDOM.defaultDocumentFeatures = {
	FetchExternalResources : false,
	ProcessExternalResources : false,
	MutationEvents : false,
	QuerySelector : false,
};

// utility to cache script objects
var scriptCache = {};
var jQueryCode = './lib/jquery-1.6.1.min.js';
jQueryCode = PATH.resolve(__dirname, jQueryCode);
jQueryCode = FS.readFileSync(jQueryCode,'utf8');
function getScriptFromPath(path){
	if (!scriptCache[path]){
		var code = FS.readFileSync(path, 'utf8');
		console.log('PATH');
		console.log(code);
		scriptCache[path] = VM.createScript(jQueryCode+'\n\n\n'+code);
	}
	return scriptCache[path];
};
function getScriptFromEval(code){
	if (!scriptCache[code]){
		scriptCache[code] = VM.createScript(jQueryCode+'\n\n\n'+code);
	}
	return scriptCache[code];
};


exports.run = function(api){
	if (!jsdomExists) {
		console.log('The @jquery() DOM-manipulation plugin can\'t run '
		+'because no jsdom library is available.');
		api.notify();
		return;
	}
	var reqInf = api.getRequestInfo();
	var respInf = api.getResponseInfo();
	var ct = respInf.headers['content-type'];
			console.log(ct);
	if (ct && ct.indexOf('html')>-1) {
		var html = api.getResponseBody();


		try{
			
			var path = api.arg(0);
			console.log(path);
			path = PATH.resolve('.',path);
			console.log(path);
			var scriptObj = getScriptFromPath(path);
		}catch(err){
			try{
				var scriptObj = getScriptFromEval(api.args(0));
			}catch(err){
				api.notify();
				throw err;
			}
		}
		
		console.log(scriptObj);
		try{
			var window = JSDOM.html(html).createWindow();
			scriptObj.runInNewContext(window);
					
			var dt = html.match(doctypePatt);
			dt = dt ? dt[1]+'\r\n' : '';
			var newHTML = dt + window.document.outerHTML;
		}catch(err){
			api.notify();
			throw err;
		}
		api.setResponseBody(newHTML);
		api.notify();
	} else {
		api.notify();
	}
};
