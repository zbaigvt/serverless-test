"use strict"
var request = require("request").defaults({jar:true})
var formatResponse = require("./formatResponse.js");
var msgStrings = require("./messageStrings.json");


// Encode parameters for URL
function buildQuery(data){
  var IGNORE = ["sso_session", "sso_token", "esb_path"];
  var query = Object.keys(data).filter(function(name){
    return IGNORE.indexOf(name) < 0;
  }).map(function(name){
    return encodeURIComponent(name) + "=" + encodeURIComponent(data[name]);
  })
  return query.join("&");
}


var environments = {
  prod: {
    // BASE_URL: "https://nusoa.northwestern.edu"
    // BASE_URL: "https://reporting.northwestern.edu/bi/cgi-bin/cognosisapi.dll/rds/reportData/searchPath//content/folder[@name='Research_Dashboard']/folder[@name='Web_Services']/reportView[@name='%COGNOS_REPORT_NAME%']"
    BASE_URL: "https://reporting.northwestern.edu/rp/cgi-bin/cognosisapi.dll/rds/reportData/searchPath//content/folder[@name='Research_Dashboard']/folder[@name='Web_Services']/reportView[@name='%COGNOS_REPORT_NAME%']",
    TRANS_URL: "https://reporting.northwestern.edu/rp/cgi-bin/cognosisapi.dll/rds/outputFormat/report/iE8CCE414B4B8443E8A69BE1C19F1A197/CSV?"
  },
  stage: {
    // BASE_URL: "https://nusoaqa.northwestern.edu"
    // BASE_URL: "https://reportingtest.northwestern.edu/bi/cgi-bin/cognosisapi.dll/rds/reportData/searchPath//content/folder[@name='Research_Dashboard']/folder[@name='Web_Services']/reportView[@name='%COGNOS_REPORT_NAME%']"
    BASE_URL: "https://reportingtest.northwestern.edu/rp/cgi-bin/cognosisapi.dll/rds/reportData/searchPath//content/folder[@name='Research_Dashboard']/folder[@name='Web_Services']/reportView[@name='%COGNOS_REPORT_NAME%']",
    TRANS_URL: "https://reportingtest.northwestern.edu/rp/cgi-bin/cognosisapi.dll/rds/outputFormat/report/i8D205A4F33344CD2A111263294FD9BB0/CSV?"
  },
  dev: {
    // BASE_URL: "https://nusoadev.northwestern.edu"
    //BASE_URL: "https://reportingdev.northwestern.edu/bi/cgi-bin/cognosisapi.dll/rds/reportData/searchPath//content/folder[@name='Research_Dashboard']/folder[@name='Web_Services']/reportView[@name='%COGNOS_REPORT_NAME%']"
    // BASE_URL: "https://reportingdev.northwestern.edu/bi/cgi-bin/cognosisapi.dll/rds/reportData/searchPath//content/folder[@name='Research_Dashboard']/folder[@name='Web_Services']/reportView[@name='%COGNOS_REPORT_NAME%']"
    BASE_URL: "https://reportingdev.northwestern.edu/rp/cgi-bin/cognosisapi.dll/rds/reportData/searchPath//content/folder[@name='Research_Dashboard']/folder[@name='Web_Services']/reportView[@name='%COGNOS_REPORT_NAME%']",
    TRANS_URL: "https://reportingdev.northwestern.edu/rp/cgi-bin/cognosisapi.dll/rds/outputFormat/report/iF315E9178FB146359ADDC6E2EBA3A30C/CSV?"

  }
}



// Make Request
// req = {
//   'stage-vars': {
//     env: 'dev|stage|prod'
//   },
//   params: {
//     querystring: {
//       sso_token: 'YOUR_SESSION',
//       (other keys): (other values);
//     }
//   }
// }
// config {} = Has the credentials for basic auth
// callback = function(err, data){};
function get(req, config, callback){
  // sort out the correct URL for the environment dynamically form the API Gateway stage variables
  var env = req['stage-vars']['env'];

  // set the fall-back to point to production
  // var BASE_URL = "https://nusoa.northwestern.edu";
  // if we have that environment, update the base URL to it.
  if (!(env in environments)){
    callback("Invalid environment:");
    return;
  }
  // build query string
  var querystring = req.params.querystring;

  var query = buildQuery(req.params.querystring);
  var jar = request.jar();
  var url
  var BASE_URL = ''
  switch(req.format){
    case 'csv':
    BASE_URL = environments[env]['TRANS_URL'];
    break;
    default:
    BASE_URL = environments[env]['BASE_URL'];
    break;
  }

  if(BASE_URL.length>0){
    // skip_ssi impacts the base_path for the Cognos URI.
    if (req.skip_sso){
      BASE_URL = BASE_URL.replace(/\/rp\//,'/SSO/');
    }
    // NOTE: we shouldn't ever have to deal with mfa and non-sso.

    // If request wants MFA, use the Cognos URL that consumes MFA tokens/sso_token
    if ('mfa' in req.params.querystring && req.params.querystring.mfa){
      console.log("Using MFA Cognos URLs");
      BASE_URL = BASE_URL.replace(/\/rp\//, '/bi/');
      // remove the mfa param. Avoid sending it to Cognos.
      delete req.params.querystring.mfa;
    }

    // set the cookie in the request.
    if (!req.skip_sso){
      console.log("  Setting the SSO cookie");
      var sso_cookie_str = "openAMssoToken=" + req.params.querystring.sso_token;
      var cookie = request.cookie(sso_cookie_str)
      jar.setCookie(cookie, BASE_URL);
    } else {
      console.log("  Not setting the SSO cookie");
    }


    if(req.format != 'csv'){
      // extract the esb_path from the queryparams
      var valid_esb_paths = [
        'RP_LandingPage',
        'RP_SingleProject',
        'RP_TransactionDetail',
        //@TODO: ATTENTION: this value will change when this
        //service gets proxied via the ESB.
        'RD300_NonSSO'
      ];
      var esb_path = req.params.querystring.esb_path;
      if (valid_esb_paths.indexOf(esb_path) < 0){
        callback("Invalid path:" + esb_path);
        return;
      }

      // Mapping from ESB report names to Cognos report names
      var esb_path_to_cognos_name = {
        'RP_LandingPage': 'RD000_Landing_Page',
        'RP_SingleProject': 'RD100_Single_Project_Page',
        'RP_TransactionDetail': 'RD200_Transaction_Detail_Page',
        //@TODO:A ATTENTION: update this key, if this gets proxied
        //via the ESB.
        'RD300_NonSSO': 'RD300_NonSSO'
      }
      var cognos_report_name = esb_path_to_cognos_name[esb_path] || esb_path;

      // replace the Cognos report name in the URL
      BASE_URL = BASE_URL.replace(/%COGNOS_REPORT_NAME%/, cognos_report_name);
      // prepare request payload
      url = BASE_URL + "?fmt=JSON&async=off&" + query;
    } else {
      // prepare request payload
      url = BASE_URL + "async=off&" + query;
    }


    // replace /bi/ with /SSO/ for non-sso requests
    if (req.skip_sso){
      BASE_URL = BASE_URL.replace(/\/bi\//, '/SSO/');
    }



  }

  // prepare the Basic Auth
  if (req.basic_auth){
    // console.log("Setting Basic Auth for request");
    var auth = 'Basic ' + new Buffer(config.username + ":"+config.password).toString('base64');

  } else {
    console.log("not setting basic auth");
  }

  var opts = {
    url : url
    // headers: {
    //   "Authorization" : auth
    // }
  }

  // Skip sending the SSO cookie
  if (!req.skip_sso){
    opts['jar'] = jar;
  }

  //@TODO: Support Basic Auth.
  if (req.basic_auth){
    opts.headers = {
      "Authorization" : auth
    }
  }
  // Pass null for CSV export
  if ('encoding' in req){
    opts.encoding = req.encoding;
  }

  console.log("making request...", url); //@TODO: REMOVE
  request.get(opts, function(err, response, body){



    if (response.statusCode === 500){
      callback("IBM_COGNOS_ERROR_500");
      return;
    }
    //NOTE: The ESB does *not* return an error for Cognos errors.
    // we need to check the statusCode.
    // fail on HTTP codes 400 and higher.
    var response = response || {};
    var statusCode = parseInt(response.statusCode);
    var HTTP_MAX_VALID_CODE = 400;


    //
    if (req.format === 'csv'){
      callback(err, response, body);  // csv
      return;
    }

    // check for if we got HTML instead of JSON.
    // Typically, this is where Cognos errors appear.
    var canary = body.match(/DOCTYPE/);
    if (canary){
      if(body.match(/OpenAM/i)){
        var msg = {
          errorMessage: "UNAUTHORIZED"
        }
        callback(null, null, msg);
      } else {
        console.log(JSON.stringify(body));
        callback(body); // throw error
      }
    } else if (statusCode >= HTTP_MAX_VALID_CODE){
      console.log("error: ", JSON.stringify(err));
      console.log("response: " , JSON.stringify(response) );
      console.log("body: " , JSON.stringify(body) );

      callback(response);
    } else {
      callback(err, response, formatResponse(JSON.parse(body)));
    }
  });
}


module.exports = {
  get: get
};
