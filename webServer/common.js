Common = {
  	DEBUG: true,
	mode: 'prod',
	exitEventString: 'close',
	datafilename : '/home/pi/production/meter_eenergy/data/gotResults.json',
	logdebug: function logdebug (mystring) { if (Common.DEBUG==true) console.log(mystring); }
};

module.exports = Common;
