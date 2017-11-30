// Local Node JS - used for testing
module.exports = {
  route: route,
  getConfig: getConfig
};

var AWS = require("aws-sdk");
var jwt = require('jsonwebtoken');
var ConfigLoader = require("./config-loader");
var UserService = require("./UserService.js");
var ContentService = require("./ContentService.js");
var PermissionService = require("./PermissionService.js");
var CookieStore = require("./CookieStore.js");
var DataExportService = require("./DataExportService.js");
var InvestigatorsService = require("./InvestigatorsService.js");
var PendingProposal = require("./PendingProposal.js");
var Footprints = require("./Footprints.js");
var ProjectionService = require("./ProjectiontoolServices.js");
var Dictionary = require("./Dictionary.js");
var DuoService = require("./DuoService.js");
var Cors = require("./Cors.js");
var resourceString = require("./messageStrings.json");
var TransactionService = require("./TransactionsConsumer.js");
var Protocols = require("./Protocols.js");

var API_VERSION = "1.0.0";

// init
AWS.config.region = "us-east-1";

// Credential setting
var ESB_PATH = "./secure/esb-secret";
var DIRECTORY_PATH = "./secure/directory-secret";
var COGNOS_PATH = "./secure/cognos-secret";
var COGNOS_NONSSO_PATH = "./secure/cognos-nonsso-secret";
var DUO_PATH = "./secure/duo-secret";
var JWT_PATH = "./secure/JWT-secret";

function getConfigFromPath(path, callback) {
  ConfigLoader.decrypt(path, AWS, callback);
}

function getConfig(callback) {
  var path = "./secure/esb-secret";
  ConfigLoader.decrypt(path, AWS, callback);
}

// function preFlight(req){
//   var token = getCookie(req.params.header.Cookie, "rdash_token")
//   jwt.verify(token, 'fakesecret', function(err, decoded) {
//     if (err) {
//       console.log(err);
//       return false
//     } else {
//       // if everything is good, save to request for use in other routes
//       console.log(decoded);
//       req.sso_token = decoded.sso_token
//       return decoded.mfa;
//     }
//   })
//
// }

// Router
function route(req, context) {
  // validate request.
  // if (!validateRequest(req)){
  //   context.fail("Invalid request");
  //   return;
  // }
  //array of events enabled cors
  var UNAUTHORIZED = {
    errorMessage: "UNAUTHORIZED"
  };
  if (resourceString.CORS_ENABLED.indexOf(req.resource) >= 0) {
    if (!Cors.isOriginValid(req)) {
      context.fail(UNAUTHORIZED);
      return;
    }
  }
  if (resourceString.DUO_ENABLED.indexOf(req.resource) >= 0) {
    var token = req.params.querystring.rdash_token
    // verify token
    getConfigFromPath(JWT_PATH, function(err, sec_config) {
      jwt.verify(token, sec_config.secret, function(err, decoded) {
        if (err) {
          console.log(err);
          handleResponseWithCors(null, null, UNAUTHORIZED);
          return
        } else {
          delete req.params.querystring.rdash_token
          req.params.querystring['sso_token'] = decoded.sso_token
          if (decoded.mfa === false) {
            handleResponseWithCors(null, null, UNAUTHORIZED);
            return
          }
          if ('Records' in req) {
            getConfigFromPath(COGNOS_NONSSO_PATH, function(err, config) {
              var event = {
                "stage-vars": {
                  env: ""
                },
                Records: req,
                skip_sso: true,
                basic_auth: true,
                format: 'csv',
                encoding: null,
                params: {
                  querystring: {
                    selection: "RD010_Download"
                  }
                }
              }
              TransactionService.consume(event, config, handleResponse)
            });
            return;
          }
          processReq();
          return
        }
      })
    })
  } else {
    processReq();
  }


  function handleResponse(error, response, body) {
    if (error) {
      console.log("err", JSON.stringify(error));
      context.fail(error);
    } else {
      context.succeed(body);
    }
  }
  //move outside
  function handleResponseWithCors(error, response, body) {
    if (error) {
      console.log("err", JSON.stringify(error));
      var ERROR = {
        errorMessage: error
      };
      var hd = Cors.getCorsHeader(req);
      var output = {
        header: hd,
        body: ERROR
      }
      context.fail(output);
    } else {
      var UNAUTHORIZED = {
        errorMessage: "UNAUTHORIZED"
      };
      var hd = Cors.getCorsHeader(req);
      var output = {
        header: hd,
        body: hd.statusCode === 200 ? body : UNAUTHORIZED
      }
      console.log("SUCCEED: ", output);
      context.succeed(output);
    }
  }





  function processReq() {
    getConfig(function(err, config) {

      //  Router
      switch (req.resource) {
        case "Version":
          var output = {
            "version": API_VERSION,
            "function": req['stage-vars']['function']
          }
          handleResponseWithCors(null, null, output);
          break;
        case "Protocols":
          Protocols.get(req, config, handleResponseWithCors);
          break;
        case "Selection":
          ContentService.get(req, config, handleResponseWithCors);
          break;
        case "TransactionsDownload":
          getConfigFromPath(COGNOS_NONSSO_PATH, function(err, config) {
            req.skip_sso = false
            req.basic_auth = false
            req.format = 'csv'
            req.encoding = null
            var sso_token = req.params.querystring.sso_token
            UserService.getNetid(sso_token, function(err, response, userdata) {
              if (err) {
                handleResponse("Unable to load user metadata for the projection's author");
                return;
              } else {
                req.params.user = userdata.cn
                req.params.email = userdata.mail

                TransactionService.consume(req, config, handleResponseWithCors)
              }
            })

          });
          break;
        case "User":
          // Get 2 keys:
          getConfigFromPath(COGNOS_NONSSO_PATH, function(err, config_cognos_nonsso_path) {
            if (err) {
              console.log("Unable to get cognos nonsso creds");
              handleResponse(err);
            } else {

              getConfigFromPath(DIRECTORY_PATH, function(err, config_directory_path) {
                if (err) {
                  console.log("Unable to get directory creds");
                  handleResponse(err);
                } else {
                  console.log("requesting service");
                  var configs = {
                    DIRECTORY: config_directory_path,
                    COGNOS_NONSSO: config_cognos_nonsso_path
                  }
                  UserService.get(req, configs, handleResponseWithCors);
                }
              });
            }
          });

          break;
        case "Permission":
          PermissionService.get(req, config, handleResponse);
          break;
        case "DataExports":
          DataExportService.get(req, config, handleResponseWithCors);
          break;
        case "Report":
          //NOTE: we are using the Cognos Service account, instead of the ESB.
          console.log("Getting Cognos Creds");

          getConfigFromPath(COGNOS_PATH, function(err, config) {
            if (err) {
              console.log("Unable to get cognos creds");
              handleResponse(err);
            } else {
              console.log("requesting service");
              ContentService.get(req, config, handleResponse);
            }
          })
          break;
        case "MockReport":
          MockContentService.get(req.data, config, handleResponse);
          break;
        case "Profile":
          getConfigFromPath(DIRECTORY_PATH, function(err, config) {
            if (err) {
              console.log("Unable to get directory creds");
              handleResponse(err);
            } else {
              console.log("requesting service");
              UserService.getExtendedAttributes(req, config, handleResponseWithCors);
            }
          })
          break;
        case "CognosEnv":
          getConfigFromPath(COGNOS_NONSSO_PATH, function(err, config) {
            if (err) {
              console.log("Unable to get cognos nonsso creds");
              handleResponse(err);
            } else {
              console.log("requesting Cognos Environment info");
              req.params.querystring.esb_path = "RD300_NonSSO";
              req.params.querystring.selection = "RD999";
              req.params.querystring.p_Invest_ID = "RD000"; //THIS FIELD IS A REQUIRED PLACEBO FOR THIS SERVICE
              // this service uses basic auth. No SSO.
              req.basic_auth = true;
              req.skip_sso = true;
              ContentService.get(req, config, handleResponseWithCors);
            }
          });
          break;
        case "ETLStatus":
          getConfigFromPath(COGNOS_NONSSO_PATH, function(err, config) {
            if (err) {
              console.log("Unable to get cognos nonsso creds");
              handleResponse(err);
            } else {
              console.log("requesting Cognos ETL refresh time info");
              req.params.querystring.esb_path = "RD300_NonSSO";
              req.params.querystring.selection = "RD998";
              req.params.querystring.p_Invest_ID = "RD000"; //THIS FIELD IS A REQUIRED PLACEBO FOR THIS SERVICE
              // this service uses basic auth. No SSO.
              req.basic_auth = true;
              req.skip_sso = true;
              ContentService.get(req, config, handleResponseWithCors);
            }
          });
          break;
        case "Investigators":
          InvestigatorsService.get(req, config, handleResponseWithCors);
          break;
        case "InvestigatorsCron":
          getConfigFromPath(COGNOS_NONSSO_PATH, function(err, config) {
            if (err) {
              console.log("Unable to get cognos nonsso creds");
              handleResponse(err);
            } else {
              console.log("requesting InvestigatorsCron");
              req.basic_auth = true;
              req.skip_sso = true;
              InvestigatorsService.cron(req, config, handleResponse);
            }
          });
          break;
        case "PendingProposal":
          PendingProposal.mark(req, config, handleResponseWithCors);
          break;
        case "PendingProposalStatus":
          PendingProposal.status(req, config, handleResponseWithCors);
          break;
        case "Ping":
          handleResponseWithCors(null, null, "Pong");
          break;
        case "Dns":
          var dns = require('dns');
          var domain = "ids-soa.it.northwestern.edu";
          dns.lookup(domain, function(err, addresses, family) {
            var result = {
              error: err,
              addresses: addresses,
              family: family
            }
            handleResponse(null, null, result);
          });
        case "Ticket":
          Footprints.createTicket(req, config, handleResponseWithCors);
          break;
        case "Projection":
          ProjectionService.get(req, config, handleResponseWithCors);
          break;
        case "ProjectionSave":
          ProjectionService.set(req, config, handleResponseWithCors);
          break;
        case "ProjectionLoad":
          ProjectionService.get(req, config, handleResponseWithCors);
          break;
        case "ProjectionRemove":
          ProjectionService.remove(req, config, handleResponseWithCors);
          break;
        case "Dictionary":
          getConfigFromPath(COGNOS_NONSSO_PATH, function(err, config) {
            if (err) {
              console.log("Unable to get cognos nonsso creds");
              handleResponse(err);
            } else {
              console.log("requesting IBM Data Dictionary entries");
              req.basic_auth = true;
              Dictionary.fetch(req, config, handleResponseWithCors);
            }
          });
          break;
        case "DuoSignRequest":
          getConfigFromPath(DUO_PATH, function(err, config) {
            if (err) {
              console.log("Unable to get cognos nonsso creds");
              handleResponse(err);
            } else {
              console.log("Duo Sign request");
              DuoService.sign_request_for_netid(req, config, handleResponseWithCors);
            }
          });
          break;
        case "DuoVerifyResponse":
          getConfigFromPath(DUO_PATH, function(err, config) {
            if (err) {
              console.log("Unable to get cognos nonsso creds");
              handleResponse(err);
            } else {
              console.log("Duo verify Response");
              DuoService.verify_response(req, config, function(err, cntxt, data) {
                if (err) {
                  handleResponseWithCors(err)
                }
                //Create token
                getConfigFromPath(JWT_PATH, function(err, sec_config) {
                  var token = jwt.sign(data, sec_config.secret, {
                    expiresIn: 60 * 60 * 4
                  });
                  handleResponseWithCors(null, null, token)
                })

              });
            }
          });
          break;
        default:
          context.fail("Invalid resource [" + req.resource + "]");
          break;
      }

    }, function(err) {
      console.log("err", err);
      context.fail("unable to load svg acct");
    });
  }
}



function validateRequest(req) {
  return true;
  // check for a SSO token.
  req.data = req.data || {};
  if (!('sso_session' in req.data)) {
    //context.fail("Invalid request -- missing data");
    return false;
  }
  return true;
}

function routeDebug(event) {
  context.succeed(event);
  context.done(null, {
    status: "OK"
  });
}
