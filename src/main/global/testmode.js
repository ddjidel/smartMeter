// ...sets a file called testmode and implements a check if mode is testmode
// 20140328
// Johannes Mainusch
//

var testFileName = '/tmp/smartMeterTestModeIsOn',
	fs = require("fs");

var testmode = {
	setOn: function (callback) { 
		fs.writeFileSync(testFileName, '');
		return (typeof callback == 'undefined') ? this : callback ();
	},	
	setOff: function (callback) {
		fs.unlinkSync(testFileName);
		return (typeof callback == 'undefined') ? this : callback ();
	},
	isSwitchedOn: function () {		
		return fs.existsSync(testFileName);
	}
}

module.exports = testmode;