#!/usr/bin/env node
/*jslint node: true */
/*
	Johannes Mainusch
	Start: 2013-03-02
	refactored: 2014-02-**
	Idea:
	The server serves data in json format from files
	The Data is in the file 'global.datafilename'
*/
var stream 		= require('stream');
var util 		= require('util');
var Transform 	= stream.Transform || require('readable-stream').Transform;

var	global 		=  global || require ("../../main/global/global.js").init("from webServer"),
	DataBase 	= require ("../../main/dataBase/dataBase.js"),
	dataBase 	= DataBase();

// the webServer Object
var ws = {
		start: startWebServer,
	};

// now start the webServer
ws.start();

// make it requirable...
module.exports = ws;



/**
	the http server is started on global.serverPort and a websocket is also started
*/
function startWebServer() {
	global.log ("in startWebServer...");
	var app = require('http').createServer(function (request, response) {
//  		response.writeHead(200, {'Content-Type':'text/plain'});
  		parseRequestAndRespond (request, response);
	}).listen(global.serverPort,  '::');

	global.log('Server is running at http://127.0.0.1:'+global.serverPort);

	// start a Web-Socket
	var webSocket = new myWebSocket ();
	webSocket
		.startSocket (app);
//		.startDataListener ();
}


/**
	parse the request and construct the server response
*/
function parseRequestAndRespond (request, response) {
	var requestPath = require('url').parse(request.url, true).pathname,
		params = require('url').parse(request.url, true),
		filter  = getUrlParameter (request, 'filter'),
		callback = getUrlParameter (request, 'callback'),
		noLines = getUrlParameter (request, 'nolines') 
					? getUrlParameter (request, 'nolines') :23,
		column = getUrlParameter (request, 'column'),
		mapRequestToMethod = {  // I do not use this yet, but keep followin g the idea
			"/getData" 		: "getData",
			"/getnolines" 	: "getNoLines"
		};
	global.log ('in parseRequestAndRespond..., requestPath='+requestPath);



	if (requestPath == global.url+'/getXref') {
		dataBase.getXref (noLines, column, function (data) {
			response.end(wrapWithCallback(data, callback) );
		});
	}

	else if (requestPath == global.url+'/getData')
		dataBase.getData (noLines, filter, function (data) {
			response.end(wrapWithCallback(data, callback) );
		});

	// get nolines returns the number of lines in the data
	else if (requestPath == global.url+'/getnolines') {
		dataBase.getNoLines (filter, function (data) {
			response.end(wrapWithCallback(data, callback) );
		});

///  continue here with teh stream thind
///		dataBase.getNoLines (filter);
	}

	// getfirst gets the first entry in the dta file
	else if (requestPath == global.url+'/getfirst')
		dataBase.getFirst ( function (data) {
			response.end(wrapWithCallback(data, callback) );
		});

	// getlast gets the last entry
	else if (requestPath == global.url+'/getlast')
		dataBase.getLast ( function (data) {
			response.end(wrapWithCallback(data, callback) );
		});

	// getglobal returns the global object to the client to transport server info
	else if (requestPath == global.url+'/getglobals') {
		response.end( wrapWithCallback( JSON.stringify(global), callback));
	}

	// server static files under url "+/client/"
	else if ( (requestPath.indexOf(global.url+'/client/') == 0 ) ){
		serveStaticFile (request, response);
	}
	else {// the last catch, if it comes here it aint good...
		global.log ('ERROR in parseRequestAndRespond, last else..., requestPath='+requestPath);
        response.writeHead(500, {"Content-Type": "text/plain"});
        response.end();
	}
}



/**
 * myModGzip is my poor mans try to compress data...
 * inspired by http://nodejs.org/api/zlib.html
 */
function myModGzip (request, response, raw) {
	var zlib = require('zlib'),
		acceptEncoding = request.headers['accept-encoding'];
  	if (!acceptEncoding) {
    	acceptEncoding = '';
  	}

  	// Note: this is not a conformant accept-encoding parser.
  	// See http://www.w3.org/Protocols/rfc2616/rfc2616-sec14.html#sec14.3
  	if (acceptEncoding.match(/\bdeflate\b/)) {
    	response.writeHead(200, { 'content-encoding': 'deflate' });
    	raw.pipe(zlib.createDeflate()).pipe(response);
  	} else if (acceptEncoding.match(/\bgzip\b/)) {
    	response.writeHead(200, { 'content-encoding': 'gzip' });
    	raw.pipe(zlib.createGzip()).pipe(response);
  	} else {
    	response.writeHead(200, {});
    	raw.pipe(response);
  	}
}

/**
	wrap the data with a callback
 */
function WrapWithCallback(options) {
  // allow use without new
  if (!(this instanceof WrapWithCallback)) {
    return new WrapWithCallback(options);
  }

  // init Transform
  Transform.call(this, options);
}
util.inherits(WrapWithCallback, Transform);


WrapWithCallback.prototype._transform = function  (data, callback) {
	if (typeof callback === 'string')
		return callback + "("+data+")";
	else
		return data;
}

/**
	wrap the data with a callback
 */
function wrapWithCallback (data, callback) {
	if (typeof callback === 'string')
		return callback + "("+data+")";
	else
		return data;
}

/**
   	start a Web-Socket that will deliver data on every new entry of the datafile
	last refactored: 20130411, JM
*/
function myWebSocket () {
	global.log('in myWebSocket');
	var objref = this;
	var tailDB;

	this.setSocket = function (socket) { this.socket = socket; return this; };

	this.startDataListener = function () {
		global.log ('webServer:myWebSocket, starting dataBase.tailDB().stream.on...');

//		dataBase.tailDB().stream.pipe(objref.socket);  // that would be cool...
		tailDB=dataBase.tailDB();
		global.log("webServer:myWebSocket, stream.ObjectID="+tailDB.ObjectID);
		tailDB.stream.on ('data', function (data) {
			global.log('webServer:myWebSocket, in dataListener, data: '+  data );
			global.log('webServer:myWebSocket, in dataListener, objref.socket: '+  objref.socket );
			if ( (typeof objref.socket === 'object') ) {
				global.log('webServer:myWebSocket, objref.socket.emit (news, data):' + data);
				// Trigger the web socket now
				objref.socket.emit ('got new data', JSON.parse (data) );
			}
		})
/**/

		return this;
	};

	this.startSocket = function (app) {
		global.log ("webServer:startSocket...");
		var io = require('socket.io')
			.listen(app)
			.sockets.on('connection', function (socket) {
				global.log ("webServer:startSocket.sockets.on connection...");
				objref.setSocket (socket);
				objref.startDataListener();
			});
		return this;
	};

	return this;
}

/**
	getFilename parses the request and gets the filename
*/
function getFilename (request) {
	var requestPath = require('url').parse(request.url, true).pathname,
		myfilename = requestPath.substring (requestPath.lastIndexOf('/')+1);
	return myfilename;
}

/**
	getMimetype parses the request and determines the mimetype
*/
function getMimetype (request) {
	var requestPath = require('url').parse(request.url, true).pathname,
		myMimeType = "text/plain",
		myFileending = requestPath.substring (requestPath.lastIndexOf('.')+1);

		switch (myFileending) {
			case "js":
				myMimeType = "text/javascript";
				break;
			case "css":
				myMimeType = "text/css";
				break;
			case "html":
				myMimeType = "text/html";
				break;
			}
	return myMimeType;
}

/**
	serveStaticFile parses the request and gets the filename and responds
*/
function serveStaticFile (request, response) {
	var myfilename = getFilename (request),
		myMimeType = getMimetype (request),
		fs = require('fs');
	fs.readFile(global.srcPath+'main/client/' + myfilename, "binary", function (err, file) {
		global.log ('readFile: ' +global.srcPath+ './client/' + myfilename);
		if (err) {
			global.log ('ERROR readFile: ' + './client/' + myfilename);
		    response.writeHead(500, {"Content-Type": "text/plain"});
		    response.write(err + "\n");
		    response.end();
		    return;
		}
		global.log ('response.write: ' + './client/' + myfilename);
		response.writeHead(200, {"Content-Type": myMimeType});
		response.write(file, "binary");
		response.end();
		global.log ('response.end: ' + './client/' + myfilename);
	});
}


/**
	getUrlParameter will parse the selector parameter from the request if present
*/
function getUrlParameter (request, selector) {
	var params = require('url').parse(request.url, true),
		urlParameter = false;

	if (params.query.hasOwnProperty(selector) === true
		&& typeof params.query[selector] === 'string' )
		urlParameter = params.query[selector];

	return urlParameter;
}

