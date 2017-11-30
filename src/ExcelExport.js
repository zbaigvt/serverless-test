var nodeExcel = require('excel-export');
var fs = require('fs');
var AWS2 = require('aws-sdk');

// settings
var WRITE_TO_LOCAL_FILE = false;

// @TODO: move this to the config.
var AWS_BUCKET_NAME = "amps-rdash-exports";

// entry point
function generateExcel(event, context){

  var reports = event.reports;
  // throw new Error("Wtf");
  var currency_keys = [
    "Amount",
    "BALANCE",
    "BUDGET",
    "ENCUMBERED",
    "_PROJECTED",
    "ACTUAL",
    "ACTUAL EXPENSE",
    "FYTD_ACTUAL_EXPENSE",
    "FYTD_PRE_ENC_ENC_EXPENSE",
    "CURRENT_EXPENSE_BUDGET",
    "EXPENSE_BUDGET_BALANCE",
    "REVENUE_LESS_EXPENSE"
  ];

  // create dummy reports for any missing reports.
  ["sponsored","non_sponsored","pending","protocols"].forEach(function(report_key){
    if ('error' in reports[report_key]){
      console.log(reports[report_key]);
      reports[report_key].headers = ['report'];
      reports[report_key].rows.push({
        report: reports[report_key].error});
    }
  });

  var combo = [reports.sponsored, reports.non_sponsored, reports.pending, reports.protocols];

  var configs = [];
  combo.forEach(function(report){
    var conf = {};
    conf.name = report.sheet_name;
    conf.cols = [];
    // console.log(headers);
    report.headers.forEach(function(key) {
      // console.log(key);
      var type;
      if (currency_keys.indexOf(key)>=0)
      type = 'number';
      else type ='string';
      conf.cols.push({
        caption: key,
        type: type
      });
    });
    conf.rows = [];
    report.rows.forEach(function(rowValues){
      var row = [];
      // console.log(JSON.stringify(rowValues));
      if(conf.name === 'protocols'){
        conf.cols.forEach(function(col){
          row.push(rowValues[col.caption])
        })
      } else {
        Object.keys(rowValues).forEach(function(col,index) {
          row.push(rowValues[col]);
        });
      }

      conf.rows.push(row);
    });

    configs.push(conf);
  });

  var data = nodeExcel.execute(configs);
  WRITE_TO_LOCAL_FILE && fs.writeFileSync('Testing.xlsx', data, 'binary');
  var binaryData = new Buffer(data, 'binary');
  // cb(binaryData);

  AWS2.config.region = 'us-east-1';
  //@TODO: DO NOT DELETE THIS LINE! DynamdeDB localhost is used elsewhere.
  AWS2.config.update({
    region: 'us-east-1',
    endpoint: null
  });
  var s3 = new AWS2.S3();

  //@TODO: rename this to the netid of the user.
  //var filename = "Test.xlsx";
  var filename = event.filename;

  var params = {Bucket: AWS_BUCKET_NAME, Key: filename, Body: binaryData};
  var EXPIRATION = 120;  // seconds

  s3.putObject(params, function(err, data) {
    if (err) {
      console.log("S3 file upload error", err);
      context.fail("S3 file upload failed");
      // context.done();
    }
    else {
      // console.log("Successfully uploaded data to myBucket/myKey");
      // Expires is in minutes
      var url = s3.getSignedUrl('getObject', {Bucket: AWS_BUCKET_NAME, Key: filename, Expires: EXPIRATION});
      context.succeed(url);
      // context.done();  // This is crucial to tell your function to wait for upload
    }
    context.done()
  });
};

module.exports = {
  generateExcel: generateExcel
}
