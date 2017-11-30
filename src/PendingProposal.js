var AWS = require("aws-sdk");
var nodemailer = require("nodemailer");
var async = require("async");
var ContentService = require("./ContentService.js");
var UserService = require("./UserService.js");
var Dictionary = require("./Dictionary.js");

AWS.config.update({
  region: "us-east-1"
});
var sns = new AWS.SNS();
var dynamodb = new AWS.DynamoDB();

//Change it to use SES to send out email to avoid accidentally unsbuscribe
var REGION = 'us-west-2';
var sender = "researchportal@northwestern.edu";

//@TODO: Store this on dynamodb

// build the DynamoDB table name based on the environment.
function getTableNames(env){
  var BASE_TABLE_NAME = "amps-rdash-pending-proposals";
  var tableMap = {status: BASE_TABLE_NAME + "-" + env, log: BASE_TABLE_NAME + "-" + env + "-log", receivers: BASE_TABLE_NAME + "-receiver-" + env};
  return tableMap;
}

//get receivers' list from DynamoDB
function getReceivers(env, callback){
  var docClient = new AWS.DynamoDB.DocumentClient();
  var scanparams = {
    TableName: getTableNames(env).receivers
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

// create DynamoDB Table
function createTable(req, callback){
  throw new Error("not implemented");
  // check if table exists
  var params = {
    TableName: "amps-rdash-pending-proposals-dev-log",
    // Set this to fixed, since dev json has problem
    // TableName: getTableName(req),
    KeySchema: {
    }
  }
  dynamoDB.describe(params, function(err, data){
    if (err){
      callback(err);
    } else {
      callback(null, data);
    }
  });
}


// Build the email message based on the request
function buildMessage(proposal_row, author, action){
  // get user info
  // get project info
  var message = [];
  message.push("The pending proposal [Institution Number:"+proposal_row['INSTITUTION_NUMBER']+"] has been marked as " + action +" by ["+author.cn+"] ["+ author.mail+"]");
  message.push("\n\n");
  var keys = Object.keys(proposal_row);
  keys.map(function(key){
    var label = Dictionary.formatLabel(key);
    var value = Dictionary.formatValue(key, proposal_row);
    // var line = key + " : " + proposal_row[key];
    var line = label + " : " + value;
    message.push(line);
  });
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
function SESNotify(env, action, proposal_row, author, callback){
  var subject = "Research Portal - Pending Proposal Marked as " + action;
    if(env!=="prod"){
    subject = subject + " in " + env.toUpperCase();
  }

  // build the message
  var message = buildMessage(proposal_row, author, action);

  getReceivers(env, function(err, receivers){
    if (err){
      callback(err);
    } else{
      var data = {
      from: sender,
      to: receivers.join(", "),
      subject: subject,
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
function notify(env, action, proposal_row, author, callback){

  //@TODO: include the environment string in the ARN
  var SNS_TOPIC_ARN = "arn:aws:sns:us-east-1:049712246386:amps-rdash-pending-proposals";
  //@TODO: make this HTML?
  var subject = "Research Portal - Pending Proposal Marked as " + action;
  if(env!=="prod"){
    SNS_TOPIC_ARN = SNS_TOPIC_ARN + "-" + env;
    subject = subject + " in " + env.toUpperCase();
  }

  // build the message
  var message = buildMessage(proposal_row, author, action);

  var params = {
    TopicArn: SNS_TOPIC_ARN,
    Message: message,
    Subject: subject
  }
  console.log(message);
  sns.publish(params, function(err, data){
    callback(err, data);
  })
}

// check if the user has access to this proposal.
// callback(err, data)
// function checkAccessProposal(_req, config, callback){
function getProposal(_req, config, callback){
  // Target proposal identifier
  var proposal_institution_number = _req.params.querystring.institution_number;
  // We need to load the entire list of Pending Proposals for this user.
  // make a call to RD001 - pending proposals for logged in user.
  var req = {
    'stage-vars': {
      env: _req['stage-vars']['env']
    },
    params: {
      querystring: {
        esb_path: "RP_LandingPage",
        selection: "RD001",
        p_Invest_ID: _req.params.querystring.p_Invest_ID,
        sso_token: _req.params.querystring.sso_token
      }
    }
  }
  ContentService.get(req, config, function(err,response, data){
    if (err){
      callback(err);
    } else {
      // check if the results include the proposal_institution_number
      var row = data.rows.filter(function(row){
        return row['INSTITUTION_NUMBER'] === proposal_institution_number;
      }).pop();
      // return the proposal row (contains all the metadata);
      callback(null, row);
    }
  })
}

//add or update item in dynamodb
function putItem(params, callback){
  var logClient = new AWS.DynamoDB.DocumentClient();
  logClient.put(params, callback);

}


/**
* Mark a pending proposal as 'not funded'.
* 1. check if the user has access to seeing the pending proposal.
* 2. Get the NETID of the logged in user via their SSO token
* 3. Store the new state on DynamoDB
* req.params.querystring.institution_id must be set!
* 4. Send the email notifcation to the AWS SNS topic
*/
// req = event request.
// callback(err, result);
function mark(req, config, callback){

  // 1. Check if user can 'see' project.
  //    Load the project from Cognos.
  getProposal(req, config, function(err, proposal_row){
    if (err){
      callback(err);
    } else {

      // if the user doesn't have access to the proposal, fail.
      if (!proposal_row){
        return callback("NO_ACCESS");
      }

      // 2. Get the netid of the user.
      var sso_token = req.params.querystring.sso_token;
      getUser(sso_token, config, function(err, author){
        if (err){
          callback(err);
        } else {
          var action = req.params.querystring.action;
          var inum = req.params.querystring.institution_number;
          var p_Invest_ID = req.params.querystring.p_Invest_ID;
          var ts = new Date().toISOString();
          var hash = inum + "|" + author.uid + "|" + ts;
          var env = req['stage-vars']['env'];
          var tn = getTableNames(env);

          // validate action
          var VALID_ACTIONS = ["NOT_FUNDED", "ACTIVE"];

          if (VALID_ACTIONS.indexOf(action.toUpperCase()) < 0){
            callback("INVALID ACTION");
            return;
          }

          // 3. DynamoDB Mark the pending proposal as current status
          var params1 = {
            TableName : tn.log,
            Item:{
              "hash" : hash,
              "action" : action,
              "institution_id" :inum,
              "request_by" : author.uid,
              "p_Invest_ID": p_Invest_ID
            }
          };

          var params2 = {
            TableName : tn.status,
            Item:{
              "status" : action,
              "institution_id" :inum,
              "timestamp" : ts,
              "updated_by" : author.uid,
              "p_Invest_ID" : p_Invest_ID
            }
          };

          var batch_puts = [
            params1, params2
          ]

          async.map(batch_puts, function(item, item_callback){
            // work on individual call
            putItem(item, item_callback);
          }, function done(err, data){
            // We are done!!!!
            if (err){
              console.log("ERR", err);
              callback(err);
            } else {
              console.log("DATA", data);

              // 4. Send Notification via email.
              SESNotify(env, action, proposal_row, author, function(err, data){
                if (err){
                  callback(err);
                } else {
                  callback(null, null, {"status":"OK"});
                }
              });
            }
          });
        }
      })
    }
  })
}


// Load the status for a list of pending proposals from DynamoDB
function status(req, config, callback){
  var iids = req.params.querystring.institution_ids.split(",");
  var env = req['stage-vars']['env'];
  var tn = getTableNames(env);
  var sso_token = req.params.querystring.sso_token;
  var keys = iids.map(it => ":" + it).join(",")

  //validate requestor
  getUser(sso_token, config, function(err, author){
    if (err){
      callback(err);
    } else {
      var docClient = new AWS.DynamoDB.DocumentClient();
      var params = {
        TableName: tn.status,
        FilterExpression: "#institution_id in (" + keys + ")",
        ExpressionAttributeNames: {
          "#institution_id": "institution_id"
        },
        ExpressionAttributeValues: {}
      };

      iids.forEach(iid => {
        var _key = ":" + iid;
        params.ExpressionAttributeValues[_key] = iid;
      })

      docClient.scan(params, function(err, data){
        if (err){
          callback(err);
        } else {
          callback(null, null, data);
        }
      });
    }
  });
}

module.exports = {
  mark: mark,
  status: status
}
