var AWS = require("aws-sdk");
var UserService = require("./UserService.js");
var ContentService = require("./ContentService.js");
var shortid = require("shortid");

// AWS config
AWS.config.update({
  region: "us-east-1"
});

//settings
var TABLE_NAME = "amps-rdash-projection-tool";

// Dynamo instance
var dynamodb = new AWS.DynamoDB();

// doc client
var docClient = new AWS.DynamoDB.DocumentClient();

// Returns the default table name for the projections
function getTableName(env){
  return TABLE_NAME + "-" + env;;
}

// store projection
function set(req, config, callback){
  // check if user can access project.
  checkAccess(req, config, function(err, response, data){
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
          projection.created = new Date().toISOString();
          projection.id = shortid.generate();
          console.log("NEW PROJECTION FOR ["+project_id+"]", projection);

          var table = getTableName(env);
          getProjections(table, project_id, function(err,data){
            if (err){
              callback(err);
            } else {
              var projections = []
              if(data!=null && data.hasOwnProperty('projections') && data.projections.length>0){
                projections = data.projections;
              }
              projections.push(projection);

              var params = {
                TableName: table,
                Item:{
                  "project_id" : project_id,
                  "projections" : projections,
                  "last_updated" : projection.created
                }
              }
              docClient.put(params, function(err, data){
                if(err){
                  callback(err);
                } else {
                  callback(null, data, params.Item);
                }
              });
            }
          })
        }
      })
    }
  })

}

function remove(req, config, callback){
  // check if user can access project.
  checkAccess(req, config, function(err, response, data){
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
          var table = getTableName(env);
          // get the project id
          var project_id = body.project_id;
          var projection_id = body.projection_id;

          getProjections(table, project_id, function(err, data){
            if (err){
              callback(err);
              return;
            } else {
              // remove the projection
              data.projections = data.projections.filter(function(projection){
                return projection.id !== projection_id;
              });

              var params = {
                TableName: table,
                Item:{
                  "project_id" : project_id,
                  "projections" : data.projections,
                  "last_updated" : new Date().toISOString()
                }
              }
              docClient.put(params, function(err, data){
                if(err){
                  callback(err);
                } else {
                  callback(null, data, params.Item);
                }
              });
            }
          })

        }
      })
    }
  })
}

function get(req, config, callback){
  // parallel request handler.
  // We want to get data from Lambda and Cognos in parallel, and then:
  var store = createStore(callback);

  // start downloading the file from Lambda
  var env = req['stage-vars']['env'];
  var table = getTableName(env);

  // extract and validate the project_id
  var project_id = req.params.querystring.project_id;

  getProjections(table, project_id, function(err, data){
    if (err){
      callback(err); // abort
      return;
    } else {
      store.update("data", data);
    }
  })

  checkAccess(req, config, function(err, response, data){
    if (err){
      console.log("Unable to verify that the user has access to the project");
      console.log(err);
      callback(err);
      return;
    } else {
      store.update("can_access", true);
    }
  })

}
// Check ACL against Cognos
function checkAccess(req, config, callback){
  //@TODO
  // ensure that netid has access to => project_id
  // THis can be implemented as a call to one of the Single Sponsored Project
  // services. Request a rowLimit of ONE. If there are *any* rows in the response
  // then the NETID should have access to writing to this projection.
  // NOTE: instead of passing a NETID, one can pass the SSO session for the logged-in
  // user. THis should come with the request into AWS Lambda via the API Gateway.
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


// Get ROW from table.
function getProjections(table, project_id,callback){
    var params = {
      TableName: table,
      KeyConditionExpression: "#project_id = :project_id",
      ExpressionAttributeNames: {
        "#project_id": "project_id"
      },
      ExpressionAttributeValues: {
        ":project_id": project_id
      }
    }
    docClient.query(params, function(err, data){
      if (err){
        callback(err);
      } else {
        if(data.Items[0]){
          callback(null, data.Items[0]);
        } else {
          var pjmap = {
            'project_id': project_id,
            'projections': []
          }
          callback(null, pjmap);
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

// Public methods
module.exports = {
  get: get,
  set: set,
  remove: remove
}
