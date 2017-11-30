var AWS = require("aws-sdk");
var nodemailer = require("nodemailer");
var ContentService = require("./ContentService.js");
var UserService = require("./UserService.js");
var Dictionary = require("./Dictionary.js");

AWS.config.update({
  region: "us-east-1"
});

// var sns = new AWS.SNS();

//Change it to use SES to send out email to avoid accidentally unsbuscribe
var REGION = 'us-west-2';
var sender = "researchportal@northwestern.edu";

// get the DynamoDB table name based on the environment.
function getTableNames(env){
  var BASE_TABLE_NAME = "amps-rdash-feedback-receiver";
  return BASE_TABLE_NAME + "-" + env;
}

//get receivers' list from DynamoDB
function getReceivers(env, callback){
  var docClient = new AWS.DynamoDB.DocumentClient();
  var scanparams = {
    TableName: getTableNames(env)
  };

  docClient.scan(scanparams, function(err, data){
    if (err){
      callback(err);
    } else {
      var receivers = [];
      data.Items.forEach(function(item, idx, array){
        receivers.push(item.email)
      });
      callback(null,receivers);
    }
  })

}

// Build the email message based on the request
function buildMessage(feedback, author){
  // get user info
  // get project info
  var message = [];
  //message.push("assignees=\"Research Portal\"");
  message.push("assignees=Research__bPortal");
  message.push("\n");
  message.push("From: "+author.cn);
  message.push("Email: "+ author.mail);
  message.push("Netid: "+ author.uid);
  message.push("URL: "+(feedback.url || 'n/a'));
  message.push("Browser: " + (feedback.browser || 'n/a'));
  message.push("\n");
  message.push((feedback.body || "n/a"));
  return message.join("\n");
}

// get the netid of a user from their SSO SEssion.
function getUser(sso_token, config, callback){
  UserService.getNetid(sso_token, function(err, response, body){
    if (err){
      callback(err);
    } else {
      callback(null, body);
    }
  })
}

//send out the notifcation via SES
function SESNotify(feedback, author, env, callback){
  var feedback_subject = "Research Portal - Feedback from ["+ author.cn+"]: " + (feedback.subject || "");
  if(env!=="prod"){
    feedback_subject = feedback_subject + " in " + env.toUpperCase();
  }

  // build the message
  var message = buildMessage(feedback, author);

  getReceivers(env, function(err, receivers){
    if (err){
      callback(err);
    } else{
      var data = {
      from: sender,
      to: receivers.join(", "),
      subject: feedback_subject,
      text: message
    };

      var transporter = nodemailer.createTransport({
        transport: 'ses',
        region: REGION
      });

      transporter.sendMail(data, function(err, data){
        if(err){
          callback(err);
        } else{
          console.log("D", data);
          callback(null,data);
        }
      });
    }
  })
}

// Send out the notifcation.
function notify(feedback, author, env, callback){

  //@TODO: include the environment string in the ARN
  var SNS_TOPIC_ARN = "arn:aws:sns:us-east-1:049712246386:amps-rdash-footprints";

  //@TODO: make this HTML?
  var subject = "Research Portal - Feedback from ["+ author.cn+"]: " + (feedback.subject || "");

  if(env!=="prod"){
    //@TODO: add topic for stage
    SNS_TOPIC_ARN = SNS_TOPIC_ARN + "-" + env;
    subject = subject + " in " + env.toUpperCase();
  }

  // build the message
  var message = buildMessage(feedback, author);

  var params = {
    TopicArn: SNS_TOPIC_ARN,
    Message: message,
    Subject: subject
  }

  // console.log("SNS payload", params);
  sns.publish(params, callback);
}


/**
* 1. Get the NETID of the logged in user via their SSO token
* req.params.querystring.institution_id must be set!
* 2. Send the email notifcation to the AWS SNS topic
*/
// req = event request.
// callback(err, result);
function createTicket(req, config, callback){
  // 1. Get the netid of the user.

  var body = req['body-json'];
  var env = req['stage-vars']['env'];

  var sso_token = body.sso_token;

  getUser(sso_token, config, function(err, author){
    if (err){
      console.log("Footprints.js: User Session was invalid. Err:", err);
      callback(err);
    } else {
      // 2. Send Notification via email.
      SESNotify(body.feedback, author, env, function(err, data){
        if (err){
          callback(err);
        } else {
          callback(null, null, {"status":"OK"});
        }
      });
    }
  });
}

module.exports = {
  createTicket: createTicket
}
