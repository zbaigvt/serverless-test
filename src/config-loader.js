var fs = require("fs");
var JSONB = require("json-buffer");

function decrypt(secretPath, AWS, callback){
  AWS.config.region = "us-east-1";
  AWS.config.update({
    endpoint: null
  });
  var KMS = new AWS.KMS();
  var encryptedSecret = fs.readFileSync(secretPath);
  if (!encryptedSecret){
    callback("Unable to read secure store.");
  } else {
    var params = {
      CiphertextBlob: encryptedSecret
    };
    KMS.decrypt(params, function(err, data){
      if (err){
        callback("KMS: " + err);
      } else {
        var decryptedSecret = data['Plaintext'].toString();
        var json = new Buffer(decryptedSecret, 'base64').toString("ascii");
        callback(null, JSON.parse(json));
      }
    });
  }
}
module.exports = {
  decrypt: decrypt
}
