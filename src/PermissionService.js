var ContentService = require("./ContentService.js");

// Check whether a user has 'read' access to a project.
// callback accepts (err,data)
function userCanViewSponsoredProjectID(user_sso_session, sponsored_project_id, callback){

  var params = {
  }
  ContentService.get(params, function(err, data){

  });
}

module.exports = {
  userCanViewSponsoredProjectID: userCanViewSponsoredProjectID
}
