"use strict";
var request = require("request");
var async = require("async");
var ContentService = require("./ContentService.js");
var msgStrings = require("./messageStrings.json");


/**
* Get Extended User Profile/Attributes
* @param  {string}   sso_session WebSSO Session Token
* @param  {object}   config      Defines the credentials for the ESB Service Account
* @param  {Function} callback    Callback with error, response and body.
* @return {Object}               User attributes
* @return {null}                 No attributes available for sso_session.
*/
function get(event_req, configs, callback){
  var sso_session = event_req.params.querystring.sso_token
  getNetid(sso_session, function(error, response, user){
    if (user && 'uid' in user){
      var netid = user.uid;
      console.log("getting ACL and extended attributes for netid:", netid);
      async.parallel([
        // Check ACcess call
        function(internal_callback){
          // define payload for CheckAccess
          var req = {
            'stage-vars': {
              env: event_req['stage-vars']['env']
            },
            params: {
              querystring: {
                sso_token: sso_session
              }
            }
          }
          // Check RD014 for user access
          checkAccess(req, configs.COGNOS_NONSSO, function(err, result, data){
            if (err){
              console.log("Unable to determine user role from RD014");
              internal_callback(err);
            } else {
              console.log("Found role for user", data);
              internal_callback(null, data);
            }
          });
        },
        // Get Extended User Attributes
        function(internal_callback){
          // getExtendedAttributes(netid, config, callback);
          var proxy_req = {
            data: {
              netid: netid
            }
          }
          // get extended user attributes
          getExtendedAttributes(proxy_req, configs.DIRECTORY, function(err, response, body){
            //@TODO: Throw if the 'err' is set.
            var data = JSON.parse(body);
            if ('results' in data){
              //console.log("got results");
              console.log("Found extended attributes for the user");
              var user = data.results.pop();
              internal_callback(null, user);
            } else {
              console.log("no user found");
              var error = "Unable to retrieve attributes";
              internal_callback(err);
            }
          });
        }

      ], function(err, results){
        if (err){
          callback(err);
        } else {
          var user = results[1] || {};
          user.RD014_ROLE = results[0];
          callback(null, null, user);
        }
      })


    } else {
      console.log('Missing parameter [uid]');
      // callback("Unable to get netid foruser", null, null);
      var msg = {
        errorMessage: "UNAUTHORIZED"
      }
      callback(null, null, JSON.stringify(msg));
    }
  });
}

/**
* Find a NETID for a WebSSO Session token
* @param  {string}   sso_session WebSSO Session token
* @param  {Function} callback    Callback with error, response, and body.
* @return {Object}               Returned via the callback.
*/
function getNetid(sso_session, callback){
  // WebSSO PROD
  var base_url = "https://websso.it.northwestern.edu:443/amserver/identity/attributes?subjectid=";

  // WebSSO DEV
  //var base_url = "https://evssodev4.ci.northwestern.edu:8443/amserver/identity/attributes?subjectid=";
  console.log("Using WebSSO@DEV !");

  var opts = {
    url: base_url + sso_session
  }
  request.get(opts, function(error, response, body){
    if (body.match(/com.sun.identity.idsvcs.TokenExpired/)){
      callback("com.sun.identity.idsvcs.TokenExpired");
    } else {

      var user_attrs = getNetidParseAttrs(body);
      if(user_attrs.uid === 'rfk9027'){
        user_attrs.mail = 's-meegan@northwestern.edu'
      }
      callback(error, response, user_attrs);
    }
  });
}

/**
* Transform results from key=value format into a JSON object.
* @param  {string} attrs Multi-line blob of attributes in format "key=value\nkey=value"
* @return {Object}       An object with properties and values.
*/
function getNetidParseAttrs(attrs){
  var rows = attrs.split("\n");
  var key = null;
  var old_key = null;
  var value = [];

  var data = {};

  var cleanKey = function(key){
    return key.replace("userdetails.attribute.", "", key);
  }

  for(var i=0; i<rows.length; i++){
    // key or value?
    var pair = rows[i].split("=");
    var left = pair.shift();
    var right = pair.join("=");

    if (left.match(/name$/)){
      key = cleanKey(right);
      data[key] = [];
      continue;
    } else if (left.match(/value$/)){
      data[key].push(right);
    }
  }
  // convert arrays with single item to strings.
  Object.keys(data).forEach(function(key){
    if (data[key].length === 1){
      data[key] = data[key][0];
    }
  });
  return data;
}

/**
* Get extended user attributes.
* @param  {string}   netid    A user's netid.
* @param  {Object}   config   Object with ESB credentials
* @param  {Function} callback Callback with error, response, and body.
* @return {Object}            Returend via the callback
*/
function getExtendedAttributes(req, config, callback){
  var netid = req.data.netid;
  // prepare the ESB credentials
  var auth = 'Basic ' + new Buffer(config.username + ":"+config.password).toString('base64');

  //var url = "https://nusoa.northwestern.edu/DirectorySearch/res/netid/exp/" + netid;
  var url = "https://ids-soa.it.northwestern.edu/IdentityMapper2/res/netid/exp/" + netid;
  //var url = "https://idmprod5a.ci.northwestern.edu/IdentityMapper2/res/netid/exp/" + netid;
  //var url = "https://idmprod4a.ci.northwestern.edu/IdentityMapper2/res/netid/exp/" + netid;
  console.log("Calling extended attributes for:", url);
  var opts = {
    url : url,
    headers: {
      "Authorization" : auth
    }
  }
  //request.get(opts, callback);
  request.get(opts, function(err, response, body){
    callback(err, response, body);
  });
}


// Check if a SSO_SESSIN can access the PI list.
// For RD014, you will get 3 possible results:
// A value of 'N' for staff (who can see all researchers)
// A value of 'Y' for researchers (who can see only themselves)
// I'm getting an error message returned when I login as a test ID without access
// @return: STAFF, RESEARCHER, NONE
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
  ContentService.get(event, config, function(err, response, data){
    if (err){
      callback(null, null, { role:"NONE"});
    } else {
      var first_row = data.rows[0] || {};
      var role = first_row['RESEARCHER_ACCESS'] || "";
      switch(role){
        case 'N':
        callback(null, null, { role:"STAFF"});
        break;
        case 'Y': // deliberate fall-through
        callback(null, null, { role:"RESEARCHER"});
        break;
        default:
        callback(null, null, { role:"NONE"});
        break;
      }
    }
  });
}

//
function getDuoMfaSignedRequest(req, config, callback){
  getNetid(req, function(err, response, data){
    if (err){
      callback(err);
    } else {


    }
  })
}

// public module methods
module.exports = {
  get: get,
  getNetid: getNetid,
  getExtendedAttributes: getExtendedAttributes,
  checkAccess: checkAccess,
  getDuoMfaSignedRequest: getDuoMfaSignedRequest
}
