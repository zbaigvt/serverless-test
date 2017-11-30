var Whitelist = require("./messageStrings.json");

function isOriginValid(req){
  var isValid = false;
  if(req.params.header.hasOwnProperty("Origin") || req.params.header.hasOwnProperty("origin")){
    var ourl = req.params.header.Origin ? req.params.header.Origin :req.params.header.origin
    isValid = Whitelist.ORIGIN.indexOf(ourl) >= 0;
  }
  return isValid;
}

function getCorsHeader(req){
  var isValid = isOriginValid(req);
  var ourl = req.params.header.Origin ? req.params.header.Origin :req.params.header.origin
  var header = {
    "statusCode": isValid ? 200 : 401,
    "Access-Control-Allow-Origin": isValid ? ourl : ''
  }
  return header;
}

module.exports = {
  isOriginValid:isOriginValid,
  getCorsHeader:getCorsHeader
}
