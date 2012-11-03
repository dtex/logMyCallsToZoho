var https = require('https'),
	neuron = require('neuron'), // For managing asyncrhonous tasks https://github.com/flatiron/neuron
	utile = require('utile'), // Adds some functionality beyond util https://github.com/flatiron/utile
	nconf = require('nconf'), // Used to pass command line param and read config.json https://github.com/flatiron/nconf
	nodemailer = require("nodemailer"), // Used to send email https://github.com/andris9/Nodemailer
	cronJob = require("cron").CronJob, // For scheduling tasks https://github.com/ncb000gt/node-cron
	plates = require("plates"), // Templating for emails https://github.com/flatiron/plates
	logMyCallsToZoho = {};
	
//
// ### Version 0.0.1
//
logMyCallsToZoho.version = [0, 0, 1];

// load our config file
nconf.argv().file({ file: './config.json' });

var manager = new neuron.JobManager();

//
// ### Retrieve a list of all calls starting with the last id + 1
//
manager.addJob('getNewCalls', {

	work: function ( nconf ) {
		
		var self = this;
		
		var req = https.request({
			host: "api.logmycalls.com", 
			headers: {
				"Accept": "application/json"
			}, 
			path: "/services/getCallDetails?api_key=" + 
				nconf.get("logMyCallsConfig:API") + "&api_secret=" + 
				nconf.get("logMyCallsConfig:Secret") + "&sort_by=id&sort_order=asc&start=" + 
				(nconf.get("logMyCallsConfig:lastCall")+1),
			port: 443,
			method: 'GET' }, 
			
			function(res) {
				var body = '';
				
				res.on('data', function (chunk) {
					body+=chunk;
				});
				
				res.on('end', function () {
					
					console.log(body);
					// parse the JSON response
					
					// For each call (use utile's each)
					
					// enqueue job to check to see if this number is recognized by zoho
					
					// enqueue job to send notification via email
					
					self.finished = true;
				});
				
			}
		);
		
		req.end();
		
		req.on('error', function(e) {
			console.error(e);
		});		
		
	}
});




// Define job to see if this number is recognized by zoho

	// if this number is recognized then enqueue job to add a call event to the lead or contact (not sure which yet)
	
	// else enqueue job to add a new lead or contact and add call(not sure which yet)
	



// Define job to add a call event to the lead or contact

	// Add call event
	
	// enqueue job to update last call in config.json




// Define job to add lead or contact and call event

	// Add lead or content
	
	// Add call event
	
	// enqueue job to update last call in config.json
	


// Define job to send notification via email

	// Send email
	
	

// 
// ### Fires every time a job finshes
// Not sure you will need this
//
manager.on('finish', function (job, worker) {
		
	var idle = true;
	
	for (i = 0, j = Object.keys(this.jobs).length; i<j; i++ ) {
		var name = Object.keys(this.jobs)[i];
		if ( Object.keys(this.jobs[name].running).length > 0 || this.jobs[name].queue.length > 0) idle = false;
	}

	// If there are not jobs running (not sure you need this)
	if (idle) {
		
	}
});
	
//
// ## Program entry point
//
var jobs = nconf.get("jobs");

// Loop through all the jobs in the config.json file and put them on chron
utile.each(jobs, function(job, key, obj) {
	new cronJob(job.schedule, 
		function(){
	    	manager.enqueue(job.type, nconf);  
	    }, null, true
	);
});

//
// ## If the user passed --mode test then run a test immediately
//
if (nconf.get('mode') === "test") {
	manager.enqueue('getNewCalls', nconf);
}