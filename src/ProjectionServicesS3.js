"use strict";
var AWS = require("aws-sdk");
var UserService = require("./UserService.js");
var ContentService = require("./ContentService.js");
var formatResponse = require("./formatResponse.js");
var shortid = require("shortid");
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

// Fetch the projections for a project
// env: prod, stage or dev.
// Callback(err, done);
function fetchFromS3(env, project_id, callback){
  // get the investigators cached version from AWS.
  if (!isValidEnv(env)){
    callback("Invalid env passed into fetchFromS3()");
    return;
  }
  if (!isValidProjectId(project_id)){
    callback("Invalid project_id passed into fetchFromS3()");
    return;
  }

  // construct the filename from the env
  var filename = getS3FilePath(env, project_id);
  var params = {
    Bucket: AWS_BUCKET_NAME,
    Key: filename
  };
  // get the file
  console.log("Calling s3....");
  s3.getObject(params, function(err, data){
    if (err){
      if(err.code==='NoSuchKey'){
        callback(err, '[]');
        return;
      }
      callback("Projections S3: " + err.code);
    } else {
      var text = data.Body.toString('ascii');
      callback(null, text);
    }
  });
}

// Generate the filename for the investigators file on S3
// based on the environment
// eg: /dev/PROJECTIONS/project_id.json
function getS3FilePath(env, project_id){
  var prefix = env + "/PROJECTIONS/";
  var filename = prefix + project_id + ".json";
  return filename;
}

// check if the project id 'looks' valid
function isValidProjectId(project_id){
  return project_id.match(/^[a-z0-9]+$/i);
}

// Store a blob of data to S3
// callback(error, data);
function storeToS3(env, project, callback){
  // get the investigators cached version from AWS.
  if (!isValidEnv(env)){
    callback("Invalid env passed into storeToS3()");
    return;

  }
  // user input sanitization
  var project_id = project.project_id;

  // validate project_id
  if (!isValidProjectId(project_id)){
    callback("Invalid Project ID");
    return;
  }

  // construct the filename from the env
  var filename = getS3FilePath(env, project_id);
  var params = {
    Bucket: AWS_BUCKET_NAME,
    Key: filename,
    Body: JSON.stringify(project)
  };

  // upload the file...
  console.log("Uploading list to s3 ["+filename+"]");
  s3.upload(params, function(err, data){
    if (err){
      callback("storeToS3 S3: " + err);
    } else {
      console.log("S3 upload success: s3://" + AWS_BUCKET_NAME + filename);
      callback(null, data);
    }
  });
}

// callback to check if a user can access a sponsored project.
// We use the 'header' service (RD006), and if we get data back (rows.lenth> 0), then
// the user can access the data.
function canUserAccessProject(req, config, callback){
  // extract properties from the request.
  //
  var project_id;
  var sso_token;

  // POST request.
  if ('body-json' in req){
    var body = req['body-json'];
    var project = body.project;
    project_id = body.project_id;
    sso_token = body['sso_token'];
    // GET request
  } else if ('params' in req){
    project_id = req.params.querystring.project_id;
    sso_token = req.params.querystring.sso_token;
  }

  var event = {
    "stage-vars": {
      env: req['stage-vars']['env']
    },
    params: {
      querystring: {
        esb_path: "RP_SingleProject",
        selection: "RD006",
        p_PrjID: project_id,
        p_FundCode: "<NONE>",
        p_DeptID: "<NONE>",
        p_FromYYYYMM: "<NONE>",
        p_ToYYYYMM: "<NONE>",
        sso_token: sso_token
      }
    }
  };
  ContentService.get(event, config, function(err,response, data){
    if (err){
      callback(err);
    } else {
      // permission check. Check if we have at least one row.
      if ('rows' in data && (data.rows || []).length > 0){
        callback(null, null, true);
      } else {
        callback("User doesn't have access to project");
      }
    }
  })
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


// save a projection.
// callback(err, response, data);
function remove(req, config, callback){

  // check if user can access project.
  canUserAccessProject(req, config, function(err, response, data){
    if (err){
      console.log("Permission DENIED");
      callback(err);
    } else {
      console.log("Permission Granted");

      // Get User's netid
      var body = req['body-json'];
      var sso_token = body.sso_token;
      UserService.getNetid(sso_token, function(err, response, userdata){
        if (err){
          callback("Unable to load user metadata for the projection's author");
          return;
        } else {

          // prepare payload for new projection
          var env = req['stage-vars']['env'];

          // get the project id
          var project_id = body.project_id;
          var projection_id = body.projection_id;

          // load existing JSON with all projections for this project
          fetchFromS3(env, project_id, function(err, data){
            var project;
            if (err){
              callback(err);
              project = {
                project_id: project_id,
                projections: []
              }
            } else {
              // parse project from persistent store.
              var project = JSON.parse(data);
            }

            // remove the projection
            project.projections = project.projections.filter(function(projection){
              return projection.id !== projection_id;
            });

            // save the project with updated projections
            storeToS3(env, project, function(err, data){
              if (err){
                callback(err);
              } else {
                // callback(null, null, data);
                // we return an updated list of projections in the same call.
                var response = {
                  s3: data,
                  projections: project.projections
                }
                callback(null, null, response);
              }
            });

          });


        }
      })

    }
  });
}



// save a projection.
// callback(err, response, data);
function set(req, config, callback){

  // check if user can access project.
  canUserAccessProject(req, config, function(err, response, data){
    if (err){
      console.log("Permission DENIED");
      callback(err);
    } else {
      console.log("Permission Granted");

      // Get User's netid
      var body = req['body-json'];
      var sso_token = body.sso_token;
      UserService.getNetid(sso_token, function(err, response, userdata){
        if (err){
          callback("Unable to load user metadata for the projection's author");
          return;
        } else {

          // prepare payload for new projection
          var env = req['stage-vars']['env'];

          // get the project id
          var project_id = body.project_id;

          // enrich projection metadata
          var projection = {};
          projection.title = body.projection.title;
          projection.data = body.projection.data;
          projection.author = {
            cn: userdata.cn,
            netid: userdata.uid // assign the NETID from the sso token to the projection
          };
          projection.created = Date.now();
          projection.id = shortid.generate();
          console.log("NEW PROJECTION FOR ["+project_id+"]", projection);

          // load existing JSON with all projections for this project
          fetchFromS3(env, project_id, function(err, data){
            var project;
            if (err){
              console.log("Project has no projections yet.", err);
              // callback(err);
              project = {
                project_id: project_id,
                projections: []
              }
            } else {
              // parse project from persistent store.
              project = JSON.parse(data);
            }

            // append new projection
            project.projections.push(projection);

            // save the project with updated projections
            storeToS3(env, project, function(err, data){
              if (err){
                callback(err);
              } else {
                // callback(null, null, data);
                // we return an updated list of projections in the same call.
                var response = {
                  s3: data,
                  projections: project.projections
                }
                callback(null, null, response);
              }
            });

          });


        }
      })

    }
  });
}

// Load the projections for a project.
// callback(err, repsonse, data);
function get(req, config, callback){

  // parallel request handler.
  // We want to get data from S3 and Cognos in parallel, and then:
  var store = createStore(callback);

  // start downloading the file from S3
  var env = req['stage-vars']['env'];

  // extract and validate the project_id
  var project_id = req.params.querystring.project_id;

  fetchFromS3(env, project_id, function(err, data){
    if (err){
      callback(err); // abort
      return;
    } else {
      store.update("data", JSON.parse(data));
    }
  });

  // Start checking for access from RD006
  canUserAccessProject(req, config, function(err, response, data){
    if (err){
      console.log("Unable to verify that the user has access to the project");
      callback(err);
      return;
    } else {
      store.update("can_access", true);
    }
  });
}

module.exports = {
  get: get,
  set: set,
  remove: remove
}
