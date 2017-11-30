var UserService = require("./UserService.js");
var ContentService = require("./ContentService.js");
var aws = require('aws-sdk');
aws.config.update({
  region: 'us-east-1'
});
var kinesis = new aws.Kinesis();
var ses = new aws.SES();
var s3 = new aws.S3();
var S3_BUCKET_NAME = "amps-rdash-exports";

function consume(event, context, callback){
  console.log("Kinesis consumer");
  //Reserved for Kinesis
  // event.Records = event.Records || [];
  // if (event.Records.length === 0){
  //   callback(null, {status: "Nothing to do"});
  //   return;
  // }
  // var records = event.Records.Records.map(record => {
  //   var json = new Buffer(record.kinesis.data, 'base64').toString('ascii');
  //   console.log("JSON", json);
  //   return JSON.parse(json);
  // });
  // event.params.querystring.p_PrjID = records[0].project_id
  // event.params.querystring.p_Invest_ID = records[0].netid
  // event["stage-vars"]["env"] = records[0].env
  // var userdata = {
  //   cn: records[0].user,
  //   mail: records[0].email,
  //   p_PrjID: records[0].project_id
  // }
  //End reservation

  //Reserved for skipping Kinesis
  var userdata = {
    cn: event.params.user,
    mail: event.params.email,
    p_PrjID: event.params.querystring.p_PrjID
  }
  //End reservation
  delete event.params.querystring.path

  //Ling's test
  // event["stage-vars"]["env"] = 'dev'
  // event.params.querystring.p_PrjID = '60013101'
  // event.params.querystring.p_Invest_ID = 'Research Portal Staff'//'SIS997'
  // event.params.querystring.p_FromCT = 0
  // event.params.querystring.p_ToCT = 5
  // // required! for csv
  // event.encoding = null;
  // var userdata = {
  //   cn: "R",
  //   mail: "rodolfo@northwestern.edu",
  //   p_PrjID: "60013101"
  // }




  ContentService.get(event, context, function(err, response, body){
    if (err){
      callback(err);
    } else {
      var filename = 'ResearchPortal_SponsoredProject_' + event.params.querystring.p_PrjID+'_Transactions_' + event.params.user + '.csv'
      uploadData(body,filename, userdata,callback);
    }
  })

}

function uploadData(excelData, filename, userdata, callback) {

  var params = {Bucket: S3_BUCKET_NAME, Key: filename, Body: excelData};

  s3.putObject(params, function(err, data) {
    var emailhtml = '';
    if (err) {
      console.log("Saving Data Exports Error",err);
      emailhtml = '<p>Sorry, your request cannot be fulfilled, please try again later.</p>'
      callback(err);
    } else {
      var url = s3.getSignedUrl('getObject', {Bucket: S3_BUCKET_NAME, Key: filename, Expires: 60*60*24*7});
      console.log("Successfully uploaded data to", S3_BUCKET_NAME + "/" + filename);
      // var expire = new Date().setDate(new Date().getDate() + 7)
      // expire = new Date().setHours(new Date(expire).getHours()-5)
      // expire = new Date(expire).toISOString().replace(/\..*$/,'')
      emailhtml = '<p>Please click <b><a href='+ url +'>here</a></b> to download the file. When the file is done downloading, you will see it at the bottom of your browser window.</p><p>The link will expire in 7 days.</p>'
    }
    console.log(emailhtml);
    Email(userdata, emailhtml,callback);

  });
}

function Email(userdata, body, callback){
  var nodemailer = require("nodemailer");

  var transporter = nodemailer.createTransport({
    transport: 'ses',
    region: 'us-east-1'
  });
  var sender = "researchportal@northwestern.edu";
  var receiver = userdata.mail
  var subject = "Transactions for " + userdata.p_PrjID + " are ready to download"
  console.log("Sent " + subject);
  var data = {
    from: sender,
    to: receiver,
    subject: subject,
    // text: body
    html: body
  };

  transporter.sendMail(data, function(err, data){
    console.log("E", err);
    console.log("D", data);
    callback(err, {}, data);
  });

}

module.exports = {
  consume: consume,
  Email:Email
}
