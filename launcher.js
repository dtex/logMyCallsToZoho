var fs = require('fs'),
	spawn = require('child_process').spawn,
    nconf = require('nconf');
	
nconf.argv()

var	lmc2zohoout = fs.openSync('./logs/lmc2zohoout.log', 'a'),
	lmc2zohoerr = fs.openSync('./logs/lmc2zohoerr.log', 'a');
		
var lmc2zoho = spawn('node', ['logMyCallsToZoho', nconf.get('debug') ? '--debug' : ''], {
	detached: true,
	stdio: [ 'ignore', lmc2zohoout, lmc2zohoerr ]
});

lmc2zoho.unref();