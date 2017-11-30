var Duo = require('duo_web');
var UserService = require('./UserService.js');

// load KMS


// config:
// {
//   host:""
//   akey:""
//   skey:""
//   ikey:""
// }
function sign_request_for_netid(req, config, callback){

  // extract netid from url.
  // var netid = req.params.querystring.netid;
  var body = req['body-json'];
  // var sso_session = body.sso_session;
  var sso_token = body.sso_token;
  if (!sso_token){
    callback("No session found");
    return;
  }
  UserService.getNetid(sso_token, function(err, response, user){
    if (err){
      console.log("Duo - unable to lookup user session", err);
      callback(err);
    } else {
      console.log("Got user", user);
      var netid = user.uid;
      console.log("Duo - Signing Request for netid:", netid);
      var sig_request = Duo.sign_request(config.ikey, config.skey, config.akey, netid);
      var result = {
        host: config.host,
        sig_request: sig_request,
        post_action: "auth.html"
      }
      callback(null, null, result);
    }
  });
}

// returns the usernamd (netid) or null
function verify_response(req, config, callback){
  var sig_response = decodeURI(req.params.querystring.sig_response).replace(/^sig_response:/,'');
  console.log("Verifying response for sig_response", sig_response);
  var auth_user = Duo.verify_response(config.ikey, config.skey, config.akey, sig_response)
  console.log("auth_user", auth_user);
  var body = {
    sso_token: req.params.querystring.sso_token
  }
  if(auth_user){
    body.mfa = true
    body.netid = auth_user
  } else {
    body.mfa = false
  }
  console.log(body);
  callback(null, null, body);
}

module.exports = {
  sign_request_for_netid : sign_request_for_netid,
  verify_response: verify_response
}
