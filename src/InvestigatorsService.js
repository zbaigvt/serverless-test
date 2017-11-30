"use strict";
var AWS = require("aws-sdk");
var ContentService = require("./ContentService.js");
var formatResponse = require("./formatResponse.js");
var app = require("./app.js");

// AWS setttings
// s3 instance.
AWS.config.update({
  region: 'us-east-1'
});

// S3 Bucket
var AWS_BUCKET_NAME = "amps-rdash-exports";

// s3 instance.
var s3 = new AWS.S3();

// setttings
// The cron job for getting hte PI list expects these many results (rows);
var PI_LIST_MIN_SIZE = 100;


// Check if request is using one of the valid environments
function isValidEnv(env){
  var valid_envs = ['prod','stage','dev'];
  return valid_envs.indexOf(env) >=0;
}

// Fetch the investigators list from S3
// env: prod, stage or dev.
// Callback(err, done);
function fetchFromS3(env, callback){
  // get the investigators cached version from AWS.
  if (!isValidEnv(env)){
    callback("Invalid env passed into fetchFromS3()");
    return;
  }
  // construct the filename from the env
  var filename = getS3FilePath(env);
  var params = {
    Bucket: AWS_BUCKET_NAME,
    Key: filename
  };
  // get the file
  console.log("Calling s3....");
  s3.getObject(params, function(err,data){
    if (err){
      callback("InvestigatorService S3: " + err.code);
    } else {
      var text = data.Body.toString('ascii');
      callback(null, text);
    }
  });
}

// Generate the filename for the investigators file on S3
// based on the environment
function getS3FilePath(env){
  var prefix = env + "/RD013/";
  var filename = prefix + "investigators.json";
  return filename;
}

// Store a blob of data to S3
// callback(error, data);
function storeToS3(env, data, callback){
  // get the investigators cached version from AWS.
  if (!isValidEnv(env)){
    callback("Invalid env passed into storeToS3()");
    return;
  }
  // construct the filename from the env
  var filename = getS3FilePath(env);
  var params = {
    Bucket: AWS_BUCKET_NAME,
    Key: filename,
    Body: JSON.stringify(data)
  };
  // upload the file...
  console.log("Uploading list to s3...");
  s3.upload(params, function(err, data){
    if (err){
      callback("storeToS3 S3: " + err);
    } else {
      console.log("S3 upload success: s3://" + AWS_BUCKET_NAME + '/' + filename);
      callback(null, data);
    }
  });
}

// Check if a SSO_SESSIN can access the PI list.
// For RD014, you will get 3 possible results:
// A value of 'N' for staff (who can see all researchers)
// A value of 'Y' for researchers (who can see only themselves)
// I'm getting an error message returned when I login as a test ID without access
function checkAccess(req, config, callback){
  var event = {
    'stage-vars': {
      env: req['stage-vars']['env']
    },
    params: {
      querystring:{
        selection: "RD014",
        esb_path: "RP_LandingPage",
        p_Invest_ID: "RD014",
        sso_token: req.params.querystring.sso_token
      }
    }
  }
  console.log("checkAccess event: ", event);
  ContentService.get(event, config, function(err, response, data){
    if (err){
      callback(err);
    } else {
      if(JSON.stringify(data).match(/UNAUTHORIZED/i)){
        callback(null,null,data)
        return
      }

      var first_row = data.rows[0];
      switch(first_row['RESEARCHER_ACCESS']){
        case 'N':
        callback(null, null, { can_view_full_pi_list:true});
        break;
        case 'Y': // deliberate fall-through
        default:
        callack(err);
        break;
      }
    }
  });
}

// Check ETL to Cognos Status
// If the ETL didn't complete, then DO NOT upload the latest PI list to S3.
// This should ONLY be called from the cron() workflow.
// callback(err, response, data)
function checkETLStatus(req, config, callback){
  var event = {
    'stage-vars': {
      env: req['stage-vars']['env']
    },
    skip_sso: true,
    basic_auth: true,
    params: {
      querystring: {
        selection: "RD998",
        esb_path: "RD300_NonSSO"
      }
    }
  };
  ContentService.get(event, config, function(err, response, etl_status){
    if (err){
      console.log("err", JSON.stringify(err));
      callback(err);
    } else {
      console.log(etl_status);
      var first_row = etl_status.rows[0];
      var last_update_time = first_row['LAST_UPDATE_TIME'];
      switch(first_row['BUILD_INDICATOR_DESCR']){
        case "Complete":
        callback(null, null, { "success":true, last_update_time:last_update_time, });
        break;
        default:
        callback("ETL Check status error:" + JSON.stringify(etl_status));
        break;
      }
    }
  })
}

// Retrieve the list of PIs from RD013.
// callback(err, response, data);
function fetchPIList(req, config, callback){
  var event = {
    'stage-vars': {
      env: req['stage-vars']['env']
    },
    skip_sso: true,
    basic_auth: true,
    params: {
      querystring: {
        selection: "RD013",
        // p_Invest_ID: "RD013",
        esb_path: "RD300_NonSSO"
      }
    }
  }
  ContentService.get(event, config, function(err, response, pi_list){
    if (err){
      callback(err);
      return;
    }
    if ('rows' in pi_list){
      var size = pi_list.rows.length;
      console.log("Received a list of ["+ size +"] PIs.");
      if (size < PI_LIST_MIN_SIZE){
        callback("PI list size was ["+size+"]. Expected at least ["+PI_LIST_MIN_SIZE+"]. Aborting.");
        return;
      } else {
        console.log("List size satisfies minimum size of ["+PI_LIST_MIN_SIZE+"]");
        console.log("Preparing to upload new PI list to S3...");
        storeToS3(req['stage-vars']['env'], pi_list, function(err, data){
          if (err){
            console.log("Error uploading PI list to S3:", err);
            callback(err);
          } else {
            console.log("PI list successfulyy uploaded to S3");
            callback(null, data);
          }
        })
      }
    } else {
      console.log("Investigators list from RD013 didn't have a key 'rows'");
      callback("Investigators list from RD013 didn't have a key 'rows'")
    }
  });
}

// Cron Callback for:
// 1. Check if the ETL to Cognos compelted RD098
// 2. Fetch RD013 from Cognos
// 3. Store list of PIs it on AWS for the correct environment!
// callback(err, response, data);
function cron(req, config, callback){
  checkETLStatus(req, config, function(err, response, data){
    if (err){
      callback(err);
    } else {
      console.log("ETL Status Check Successful", data);
      fetchPIList(req, config, function(err, response, data){
        if (err){
          callback(err);
        } else {
          console.log("Investigators List Successfully fetched and uploaded to S3");
        }
      });
    }
  });
}


//@TODO: Improve this.
// This is an utility used to handle parallel HTTP requests that return callbacks.
function createStore(callback){
  return {
    store: {
      count: 0,
      can_access: false,
      data: "",
    },
    update: function(key, value){
      this.store.count++;
      if (key in this.store){
        this.store[key] = value;
      }
      // we only have 2 calls, one for access check, other for populting the data.
      if (this.store.count >= 2){
        callback(null, null, this.store.data);
      }
    }
  }
}

// callback(err, repsonse, data);
function get(req, config, callback){

  var store = createStore(callback);

  // start downloading the file from S3
  var env = req['stage-vars']['env'];
  fetchFromS3(env, function(err, data){
    if (err){
      callback(err); // abort
      return;
    } else {
      store.update("data", JSON.parse(data));
    }
  });

  // Start checking for access from RD014.
  checkAccess(req, config, function(err, response, data){
    if (err){
      callback(err);
      return;
    } else {
      store.update("can_access", data.can_view_full_pi_list);
    }
  });
}

module.exports = {
  get: get,
  cron: cron
}
