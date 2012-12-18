var https = require('https'),
	neuron = require('neuron'), // For managing asyncrhonous tasks https://github.com/flatiron/neuron
	utile = require('utile'), // Adds some functionality beyond util https://github.com/flatiron/utile
	nconf = require('nconf'), // Used to pass command line param and read config.json https://github.com/flatiron/nconf
	nodemailer = require("nodemailer"), // Used to send email https://github.com/andris9/Nodemailer
	cronJob = require("cron").CronJob, // For scheduling tasks https://github.com/ncb000gt/node-cron
	plates = require("plates"), // Templating for emails https://github.com/flatiron/plates
	_ = require("underscore")._, // Utility library
	builder = require("xmlbuilder"), // Assembles XML documents (for posting to Zoho)
	logMyCallsToZoho = {};
	
process.title = 'logMyCallsToZoho';
	
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
					
					// parse the JSON response
					var calls = JSON.parse(body);
					
					// For each call (use utile's each)
					utile.each(calls.results, function( call, idx, obj) {
						// enqueue job to check to see if this number is recognized by zoho
						setTimeout(function () {
							manager.enqueue('checkContactNumber', call );
						}, (5000*idx));
							
					});
					
					// enqueue job to send notification via email
					manager.enqueue('sendNotification', calls.results.length);
					
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

//
// ### See if the number is a recognized contact in Zoho
//
manager.addJob('checkContactNumber', {

	work: function ( callObject ) {
		
		var self = this,
			formattedNumber = callObject.caller_id.substring(0,3)+"-"+
					 callObject.caller_id.substring(3,6)+"-"+
					 callObject.caller_id.substring(6,10);
			
		var req = https.request( { 
			host: "crm.zoho.com", 
			headers: {
				"Accept": "application/json"
			}, 
			path: "/crm/private/json/Contacts/getSearchRecords?version=2&authtoken=" + nconf.get("zohoConfig:apiToken") + "&scope=crmapi" +
			"&selectColumns=Contacts(contactid,Email)&searchColumn=email&searchCondition=(Phone|contains|*"+formattedNumber+"*)",
			port: 443,
			method: 'GET' },
		
			function(res) { 
				var body = '';
				
				res.on('data', function (chunk) {
					body+=chunk;
				});
				
				res.on('end', function () {
					
					var matches = JSON.parse(body);
					if(_.has(matches.response, 'result')) {
						manager.enqueue('addEventToContact', callObject, matches.response.result.Contacts.row );
					} else {
						manager.enqueue('createNewContact', callObject );
					}
					
					self.finished = true;
				});

			}
		);
		
		req.end();
		
		req.on('error', function(e) {
			console.error(e)
		})
	}
});

//
// ## Add a call event to the contact
//
manager.addJob('addEventToContact', {

	work: function ( callObject, contactObject ) {
		
		var self = this,
			duration = String(Math.floor(Number(callObject.duration)/60)) + ':' + String(Number(callObject.duration)%60);
			xml = builder.create('Calls'),
			row = xml.ele('row', {'no': '1'});
		row.ele('FL', 'New Call', {'val': 'Subject'});
		row.ele('FL', 'Inbound', {'val': 'Call Type'});
		row.ele('FL', contactObject.FL.content, {'val': 'CONTACTID'});
		row.ele('FL', callObject.calldate.toString(), {'val': 'Call Start Time'});
		row.ele('FL', duration, {'val': 'Call Duration'});
		row.ele('FL', 'Call to '+callObject.tracking_number + ' ' + callObject.tracking_number, {'val': 'Description'});
		
		xmlText = encodeURIComponent(xml.toString("utf8"));
				
		var Path = "/crm/private/json/Calls/insertRecords?authtoken=" + nconf.get("zohoConfig:apiToken") + "&scope=crmapi&newFormat=1&xmlData=" + xmlText
		
		var req = https.request( { 
			host: "crm.zoho.com", 
			path: Path,
			port: 443,
			method: 'GET' },
		
			function(res) { 
				var body = '';
				
				res.on('data', function (chunk) {
					body+=chunk;
				});
				
				res.on('end', function () {					
					self.finished = true;
					
				});

			}
		);
		
		req.end();
		
		req.on('error', function(e) {
			console.error(e)
		})
	}
	
});

//
// ## Add a new contact
//
manager.addJob('createNewContact', {

	work: function ( callObject ) {
		
		var self = this,
			formattedNumber = callObject.caller_id.substring(0,3)+"-"+
					 callObject.caller_id.substring(3,6)+"-"+
					 callObject.caller_id.substring(6,10);
			xml = builder.create('Contacts'),
			row = xml.ele('row', {'no': '1'});
		row.ele('FL', formattedNumber, {'val': 'Phone'});
		row.ele('FL', 'New', {'val': 'First Name'});
		row.ele('FL', 'Caller', {'val': 'Last Name'});
		
		xmlText = encodeURIComponent(xml.toString("utf8"));
		console.log('Create New Contact');
		console.log(xml.toString("utf8"));
		
		 var Path = "/crm/private/json/Contacts/insertRecords?authtoken=" + nconf.get("zohoConfig:apiToken") + "&scope=crmapi&newFormat=1&xmlData=" + xmlText;

		var req = https.request( { 
			host: "crm.zoho.com",
			path: Path,
			//port: 443,
			method: 'GET' },
		
			function(res) { 
				var body = '';
				
				res.on('data', function (chunk) {
					body+=chunk;
				});
				
				res.on('end', function () {
					body = JSON.stringify(body);
					if(_.has(body, 'response')) {
						_.each(body.response.result.recorddetail.FL, function(obj, index) {
							if(obj.val ==="Id") {
								contactObject = { 'no': '1', 'FL': { 'content': obj.content, 'val': 'CONTACTID' } };
							}
						});
					} else {
						console.log('Failed to add new contact('+formattedNumber+'): ' + body);
					}
					
					manager.enqueue('addEventToContact', callObject, contactObject)
					self.finished = true;
				});

			}
		);
		
		req.end();
		
		req.on('error', function(e) {
			console.error(e)
		})
		
	}
	
});


//
// ## Send notification via email
//
manager.addJob('sendNotification',  {
	
	work: function (callCount) {

		var self = this,
			now = new Date();

		// create reusable transport method (opens pool of SMTP connections)
		var smtpTransport = nodemailer.createTransport("SMTP",{
		    host: nconf.get("smtp:host"),
		    port: nconf.get("smtp:port"),
		    auth: {
		        user: nconf.get("smtp:user"),
		        pass: nconf.get("smtp:pass")
		    }
		});
		
		// Populate template
		var html = nconf.get("templates:newCallsNotification");
		var data = { 
			"callCount": callCount
		};
		var output = plates.bind(html, data); 
		
		// Create email
		var mailOptions = {
		    from: nconf.get("smtp:from"),
		    to: "donovan@donovan.bz",
		    subject: nconf.get("smtp:subject") + " " + now.toString(),
		    text: output,
		    html: output,
		    headers: {"X-SMTPAPI": {"category": "Uptown Call Notification"}}
		}
		
		// send mail with defined transport object
		setTimeout(function () {
			smtpTransport.sendMail(mailOptions, function(error, response){
			    if(error){
			        console.log(error);
			   }
			
			});
		}, (5000*callCount));
		
		self.finished = true;
	}
					
});	
	

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