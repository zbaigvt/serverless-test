var fs = require("fs");

  var reports = {
    "RD000": "../data/RD000-RD000.json",
    "RD001": "../data/RD001-CAM493.json",
    "RD002": "../data/RD002-CAM493.json",
    "RD003": "../data/RD003-CAM493.json"
  };

function get(report_id, config, cb){
  if (report_id in reports){
    var data = fs.readFileSync(secretPath);
    console.log(data);
  }
}

module.export = {
  get: get
};
