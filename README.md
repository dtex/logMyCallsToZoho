logMyCallsToZoho.js
==========

A node app that will query Log My Calls for new call records and then enter them as new contacts in Zoho or if the phone number matches an existing contact it will enter a new event on that contact.

Documented [source code](http://dtex.github.com/logMyCallsToZoho/docs/logMyCallsToZoho.html)

I have only tested in node 0.8.6

## Getting Started ##

You'll need node.js of course. Get it from [http://nodejs.org](nodejs.com).

Grab the logMyCallsToZoho files from the [https://github.com/dtex/logMyCallsToZoho/downloads](downloads) and unzip to the folder where you would like for logMyCallsToZoho to reside.

From the command line run "npm install" inside the logMyCallsToZoho folder.

##Configure your install##

Rename sample-config.json to config.json and edit as described below.

### LogMyCalls API Configuration ###
	
	"API": YourAPIKey,
	"Secret": YourSecret,
	"lastCall": 0

### Zoho API Configuration ###

### SMTP Configuration ###

Enter your SMTP server details

    "smtp": {
        "host": "smtp.sendgrid.net",
        "port": "587",
        "user": "********",
        "pass": "********"
    },

### Job Scheduling ###
		
jobs is an array of job objects. Each job object consists of:
 schedule: a [cron formatted](http://www.nncron.ru/help/EN/working/cron-format.htm) string,
 type: Currently the only valid value is getNewCalls. We may add more types later
     "jobs": [
        {
            "schedule": "00 [00,15,30,45] * * * *",
            "type": "getNewCalls"
        }
    ],

This example equates to:
* Every 15 minutes run getNewCalls

Be sure to check the system time where this will be running. I once spent more time than I care to admit debugging a job scheduler when it turned out that the system time was just wrong.
	
### Email Templates ###

templates is an object that contains all the templates used (currently only the newCallsNotification). This is the template for the email that will be sent to users. Feel free to make it as fancy as you like.

    "templates": {
        "newCallsNotification": "<p><b>Hi <span id=\"name\"></span>, you have had <span id=\"callCount\"></span> new calls logged to Zoho</b></p>"
    }
    
This span will be populated with the recipient's name.

    <span id=\"name\"></span> 

This span will contain the number of new calls processed.

    <span id=\"callCount\"></span>
    
## Running the app ##
	
From the command line run "node logMyCallsToZoho". logMyCallsToZoho will run until it is stopped or the current terminal session has ended.

Running "node logMyCallsToZoho --mode test" will do the same, but will trigger an immediate getNewCalls check, regardless of the schedule.

Running "node launcher" will run logMyCallsToZoho as a service so that it stays running even after the current terminal session has ended. It will NOT restart logMyCallsToZoho if logMyCallsToZoho or the server crashes for some reason.