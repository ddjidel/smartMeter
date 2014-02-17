#!/usr/bin/env node
/*jslint node: true */
/*
	Johannes Mainusch
	Start: 2013-03-02
	refactored: 2014-02-**
	Idea: 
	The server serves data in json format from files
	The Data is in the file 'datafilename'	
*/

// the webServer Object
var ws = {
		eventEmitter: new (require('events').EventEmitter),

		init: initWebServer,
		start: startWebServer,
		log: function log (s) { 
			if (ws.DEBUG==true)  console.log("webServer: "+s);
			return this;
			}
	};



// initialize the webserver
ws.eventEmitter.on('init', function () {ws.log ('...webserver init done'); });

// if $1 option is testmode, then start the simulator...
ws.eventEmitter.on('init', function() {
	ws.datafilename = '/tmp/data/gotResults.json';
	ws.exitEventString = 'exit';	
});



// start the webserver after ws.init()
ws.eventEmitter.on('init', ws.start );



// now initialize the webserver, and kickstart things
ws.init ();

// make it requirable...	
module.exports = ws;




/*
 * a nice constructor function (from Christopher) that reads the 
 * webServer.json file and populates the ws object
 */
function initWebServer (callback) {
	var objref = this,
		params = require ('./webServer.json'),
		i=0;

	// Simple constructor, links all parameters in params object to >>this<<
	if (params && Object.keys && Object.keys(params).length >= 1) {
		ws.log ("initializing with params");
		
		Object.keys(params).forEach( function(param) {
			objref[param] = params[param];
			ws.log ("setting this."+param+"="+ params[param]);

			if (++i == Object.keys(params).length ) {
				ws.eventEmitter.emit('init');
			}
		})
	}

	if (typeof callback == 'function') { // make sure the callback is a function
        callback.call(this); // brings the scope to the callback
    }
	return this;
}


/**
	the http server is started on ws.serverPort and a websocket is also started
*/ 
function startWebServer() {
	var app = require('http').createServer(function (request, response) {
  		response.writeHead(200, {'Content-Type':'text/plain'});
  		server_response (request, response);
		//  response.end( server_response (request) );
	}).listen(ws.serverPort,  '::');
	
	ws.log('Server is running at http://127.0.0.1:'+ws.serverPort);

	// start a Web-Socket
	var webSocket = new myWebSocket ();
	webSocket
		.startSocket (app)
		.startDataListener (ws.datafilename);
}


/** 
	parse the request and construct the server response
*/
function server_response (request, response) {
	ws.log ('in server_response, request: ' + request.url);
	var path = require('url').parse(request.url, true).pathname;
	
	// parse the request
	ws.log ('in server_response, pathname: ' + path );
	if (path == ws.url+'/get') get (request, response, ws.datafilename);		

	// get gets the last 100 or so entries in the datafile
	else if (path == ws.url+'/getnolines') getnolines (request, response, ws.datafilename);		

	// getfirst gets the first entry in the dta file
	else if (path == ws.url+'/getfirst') executethis (request, response, ws.datafilename, 'head -1 ');		
	
	// getlast gets the last entry
	else if (path == ws.url+'/getlast') executethis (request, response, ws.datafilename, 'tail -1 ');		
	
	// server static files under url "+/client/"
	else if ( (path.indexOf(ws.url+'/client/') == 0 ) ){
		var myfilename = path.substring (path.lastIndexOf('/')+1),
			myMimeType = "text/plain",
			myFileending = path.substring (path.lastIndexOf('.')+1);
		
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

		ws.log ('serving static file: ' + myfilename + "myFileending:" + myFileending + "  mimeType: " + myMimeType);
		
		var fs = require('fs');
		fs.readFile('./client/' + myfilename, "binary", function (err, file) {
			ws.log ('readFile: ' + './client/' + myfilename);
			
		            if (err) {
						ws.log ('ERROR readFile: ' + './client/' + myfilename);
		                response.writeHead(500, {"Content-Type": "text/plain"});
		                response.write(err + "\n");
		                response.end();
		                return;
		            }
					
					ws.log ('response.write: ' + './client/' + myfilename);
		            response.writeHead(200, {"Content-Type": myMimeType});
		            response.write(file, "binary");
		            response.end();	
					ws.log ('response.end: ' + './client/' + myfilename);
			});

	}
}

/**
	getfirst will return the first entry
*/
function executethis (request, response, filename, cmd) {
	ws.log ('in executethis');	
	var params = require('url').parse(request.url, true),
		exec = require('child_process').exec,
		data;

	if (params.query.hasOwnProperty('filter') === true && typeof params.query.filter === 'string' ) 
		cmd = 'cat ' + filename + ' | grep ' + params.query.filter + " | " + cmd;
	else
		cmd = cmd + filename;
			
	exec(cmd, function (error, data) {
		ws.log('callback in executethis, cmd: ' + cmd + "\n" +data);
		response.end( data );
	});
}

/**
	getnolines will return the number of lines in the file
*/
function getnolines (request, response, filename) {
	ws.log ('in getnolines');	
	var params = require('url').parse(request.url, true),
		cmd = "cat " + filename,
		exec = require('child_process').exec,
		responseData=params.query.callback+"([";
		

		if (params.query.hasOwnProperty('filter') === true && typeof params.query.filter === 'string' ) 
			cmd += ' | grep ' + params.query.filter;
		 
		cmd += " | wc -l | awk '{print $1}'";

		exec(cmd, function (error, data) {
			ws.log('callback in getnolines, cmd: ' + cmd + "\n" +data);
			responseData += data+"])";
			response.end( responseData );
		});
}


/**
   	read and return the tweets from ./gotTweets.json
   	and return as jsonp
	This function takes parameters like filter to 'grep filter'
	and nolines to 'tail -nolines'...
*/
function get (request, response, filename) {
	var params = require('url').parse(request.url, true),
		spawn = require('child_process').spawn,
		tail,
		nolines = "-100",
		responseData=params.query.callback+"([";
		
	ws.log ('in get, pathname= ' + params.pathname);
    response.writeHead(200, {'Content-Type': 'application/json'});
	
	if (params.query.hasOwnProperty('nolines') === true && typeof params.query.nolines === 'string' ) {
		nolines="-"+params.query.nolines;
	}
	tail 	= spawn('tail', [nolines, filename]);
	
	tail.stdout.on ('data', function (data) {
	  	ws.log('in get, tail stdout: + data.len=' + data.length);
        responseData += String(data).replace(/\n/g, ',\n');		// replace newlines by ',\n'
	});
	
	tail.stderr.on('data', function (data) {
	  	ws.log('tail stderr: ' + data);
	});

	// the raspberry likes close here instead of exit...
	//	tail.on('close', function (code) {
	tail.on(ws.exitEventString, function (code) {
		responseData = responseData.replace(/,\n$/, '\n');		// removed the last ,
        responseData += "])";
	  	console.log('child process exited with code ' + code + "\nresponseData: + responseData");
      	response.end(responseData);	
	});	
}


/**
   	start a Web-Socket that will deliver data on every new entry of the datafile
	last refactored: 20130411, JM
*/
function myWebSocket () {
	
	ws.log('in myWebSocket');
	var objref = this;	
	
	this.setSocket = function (socket) { this.socket = socket; return this; };

	this.startDataListener = function (filename) {
		ws.log ('started dataListener on file: '+ filename);
		var tail  = require('child_process')
			.spawn('tail', ['-f', '-n1', filename])
			.stdout.on ('data', 
				function (data) {
		  			ws.log('in dataListener, data: '+  data );
					if ( (typeof objref.socket === 'object') ) {
						ws.log('objref.socket.emit (news, data):' + data);
						// Trigger the web socket now
						objref.socket.emit ('got new data', JSON.parse (data) );
					}
				});
		return this;
	};
		
	this.startSocket = function (app) {
		var io = require('socket.io')
			.listen(app)
			.sockets.on('connection', function (socket) {
				objref.setSocket (socket);
			});
		return this;
	};
		
	return this;
}

