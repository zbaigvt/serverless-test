var request = require("request");
var async = require("async");
var ContentService = require("./ContentService.js");
//var RDashExports = require("./RDashExports.js");
var ExcelExport = require("./ExcelExport.js");
var app = require("./app.js");
var dateFormat = require("dateformat");
var ProjectExport = require("./rdash-exports.js");
var DateUtils = require("./DateUtils.js");
var UserService = require("./UserService.js");
var Protocols = require("./Protocols.js");

var aws = require('aws-sdk');
aws.config.update({
  region: 'us-east-1'
});
var kinesis = new aws.Kinesis();
// Composable method -- get the list of sponsored projects for a user.
function _getProtocols(req, config, callback){
  var proxyContext = {
    fail: function(err){
      callback(err);
    },
    succeed: function(data){
      callback(null, data);
    }
  };
  req.params.querystring.service = "byNetID"
  req.params.querystring.queryid = req.params.querystring.p_Invest_ID
  Protocols.get(req, config, function(err, response, data){
    if (err){
      callback(err, null, null);
    } else {
      callback(err, null, data);
    }
  })
}
//RD017
function _getSubcontracts(req, config, callback){
  req.params.querystring.selection = "RD017";
  var proxyContext = {
    fail: function(err){
      callback(err);
    },
    succeed: function(data){
      callback(null, data);
    }
  };
  ContentService.get(req, config, function(err, response, data){
    if (err){
      callback(err, null, null);
    } else {
      callback(err, null, data);
    }
  });
}

//RD016
function _getPayments(req, config, callback){
  req.params.querystring.selection = "RD016";
  var proxyContext = {
    fail: function(err){
      callback(err);
    },
    succeed: function(data){
      callback(null, data);
    }
  };
  ContentService.get(req, config, function(err, response, data){
    if (err){
      callback(err, null, null);
    } else {
      callback(err, null, data);
    }
  });
}

//RD003
function _getSponsoredProjects(req, config, callback){
  req.params.querystring.selection = "RD003";
  var proxyContext = {
    fail: function(err){
      callback(err);
    },
    succeed: function(data){
      callback(null, data);
    }
  };
  ContentService.get(req, config, function(err, response, data){
    if (err){
      callback(err, null, null);
    } else {
      callback(err, null, data);
    }
  });
}

// RD002
function _getNonSponsoredProjects(req, config, callback){
  req.params.querystring.selection = "RD002";
  var proxyContext = {
    fail: function(err){
      callback(err);
    },
    succeed: function(data){
      callback(null, data);
    }
  };
  ContentService.get(req, config, function(err, response, data){
    if (err){
      callback(err, null, null);
    } else {
      callback(err, null, data);
    }
  });
}

// RD001
function _getPendingProposals(req, config, callback){
  req.params.querystring.selection = "RD001";
  var proxyContext = {
    fail: function(err){
      callback(err);
    },
    succeed: function(data){
      callback(null, data);
    }
  };
  ContentService.get(req, config, function(err, response, data){
    if (err){
      callback(err, null, null);
    } else {
      callback(err, null, data);
    }
  });
}

// callback takes two args: (error, data);
function generateUserProjectPortfolio(req, _, callback){

  // pre-populate the ESB_PATH for all these services
  req.params.querystring.esb_path = "RP_LandingPage";

  var fakeContext = {
    done: function(err, data){
      console.log("error", err);
      callback(err, null, data);
    },
    succeed: function(url){
      console.log("URL", url);
      callback(null, null, url);
    }
  };

  // auto generate a filename based on the username
  function makeFilename(netid){
    var date = dateFormat(Date.now(), "isoDateTime");
    return "ResearchPortal_" + (netid || "report") + "." + date + ".xlsx";
  }

  app.getConfig(function(err, config){
    if (err){
      callback(err);
    } else {

      //@TODO: This waits for the 3 requests to respond.
      var counter = 0;
      var reports = {
        sponsored: {},
        non_sponsored: {},
        pending: {},
        protocols: {}
      }
      // delegate for updateing the responseses from services
      var update = function(key, value){
        reports[key] = value;
        counter++;
        if (counter >= 4){
          submit();
        }
      }
      // This is called when the 3 services have returned data.
      function submit(){
        // set the sheet names for the excel doc
        var keys = ["sponsored","non_sponsored","pending","protocols"];
        keys.forEach(function(key){
          reports[key]['sheet_name'] = key;
        });
        var event = {
          report_title : "foo",
          filename: makeFilename(req.params.querystring.p_Invest_ID),
          reports: reports
        }
        //RDashExports.generateExcel(event, fakeContext );
        ExcelExport.generateExcel(event, fakeContext );
      }

      // fetch data
      _getProtocols(req, config, function(err, response, data){
        if (err){
          callback(err, null, null);
        } else {
          var rows = data.iacuc.concat(data.irb)
          var headers = ["protocol_id", "protocol_name", "expiration_date", "protocol_status", "initial_approval_date", "last_approval_date"]
          var report = {
            "rows": rows,
            "headers": headers
          }
          update('protocols', report);
        }
      });
      _getPendingProposals(req, config, function(err, response, data){
        if (err){
          callback(err, null, null);
        } else {
          update('pending', data);
        }
      });
      _getSponsoredProjects(req, config, function(err, response, data){
        if (err){
          callback(err, null, null);
        } else {
          update('sponsored', data);
        }
      });
      _getNonSponsoredProjects(req, config, function(err, response, data){
        if (err){
          callback(err, null, null);
        } else {
          update('non_sponsored', data);
        }
      });

    }
  })
}

//
// function simple(){
//   var inputs = [
//     {
//       value: 5,
//       delay: 500
//     },
//     {
//       value: 42,
//       delay: 5
//     }
//   ];
//   function process(inputs, callback){
//     setTimeout(function(){
//       var result = inputs.value * 2;
//       callback(null, result);
//     }, inputs.delay);
//   }
//
//   function complete(err, result){
//     if (err){
//       console.log("ERR", err);
//     } else {
//       console.log("result", result);
//     }
//   }
//   async.map(inputs, process, complete);
// }

function generateSponsoredProjectReport(req, config, handleResponse){

  var project_id = req.params.querystring.p_PrjID || "n/a";

  // project overview
  var overview_opts = JSON.parse(JSON.stringify(req));
  overview_opts.params.querystring.selection = "RD006";

  // inception to date.
  var itd_opts = JSON.parse(JSON.stringify(req));
  itd_opts.params.querystring.selection = "RD007";
  // set the date
  var d = new Date();
  var yyyy = d.getFullYear();
  var mm = (d.getMonth() + 1)
  mm = mm < 10 ? "0" + mm:  mm;
  var end_dt = "" + yyyy + mm;
  var start_dt = "" + (yyyy - 5) + mm;
  itd_opts.params.querystring.p_FromYYYYMM = start_dt;
  itd_opts.params.querystring.p_ToYYYYMM = end_dt;

  // expenses by month
  var expenses_by_month_opts = JSON.parse(JSON.stringify(req));
  expenses_by_month_opts.params.querystring.selection = "RD008";

  // generate date range
  var by_month_start_dt = DateUtils.addMonths(yyyy, parseInt(mm, 10), -60 + 5);
  if (by_month_start_dt[1] < 10){
    by_month_start_dt[1] = "0" + by_month_start_dt[1];
  }
  by_month_start_dt = by_month_start_dt.join('');

  var by_month_end_dt = DateUtils.addMonths(yyyy, parseInt(mm,10), +5);
  if (by_month_end_dt[1] < 10){
    by_month_end_dt[1] = "0" + by_month_end_dt[1];
  }
  by_month_end_dt = by_month_end_dt.join("");

  // var by_month_end_dt = DateUtils.addMonths(yyyy, parseInt(mm,10), +5).join("");
  expenses_by_month_opts.params.querystring.p_FromYYYYMM = by_month_start_dt
  expenses_by_month_opts.params.querystring.p_ToYYYYMM = by_month_end_dt;

  // cost share details
  var cost_share_opts = JSON.parse(JSON.stringify(req));
  cost_share_opts.params.querystring.selection = "RD009";

  // payments details
  var payments_opts = JSON.parse(JSON.stringify(req));
  payments_opts.params.querystring.selection = "RD016";

  // subcontracts details
  var subcontracts_opts = JSON.parse(JSON.stringify(req));
  subcontracts_opts.params.querystring.selection = "RD017";

  // map the list of input data to be processed asynchronously.
  var inputs = [overview_opts, itd_opts, expenses_by_month_opts, cost_share_opts, payments_opts, subcontracts_opts];

  // process callback for async
  function process(input, callback){
    ContentService.get(input, config, function(err, response, data){
      if (err){
        callback(err);
      } else {
        callback(null, data);
      }
    });
  }

  // Callback for completion (after all tasks have comlpeted)
  // result: [result1, result2, result3, result4];
  function complete(err, result){
    console.log("RESULT");

    var overview_data = result[0];
    var itd_data = result[1];
    var expenses_by_month_data = result[2];
    var cost_share_data = result[3];
    var payments_data = result[4];
    var subcontracts_data = result[5];


    // AGGREGATION - enrich the results with the respective 'selection'.
    overview_data.selection = "RD006";
    itd_data.selection = "RD007";
    expenses_by_month_data.selection = "RD008";
    cost_share_data.selection = "RD009";
    payments_data.selection = "RD016";
    subcontracts_data.selection = "RD017";

    var event = {
      report_title: "Sponsored Project Report (Project ID: "+ project_id + ")",
      reports: {
        project_overview: overview_data,
        by_month: expenses_by_month_data,
        cost_share_detail: cost_share_data,
        inception_to_date: itd_data,
        payments: payments_data,
        subcontracts: subcontracts_data
      }
    }

    event.reports.inception_to_date.projections = [];

    event.reports.project_overview.title = "Overview ";
    event.reports.inception_to_date.title = "Inception to Date";
    event.reports.inception_to_date.headers.push("PROJECTIONS"); // @TODO: move this to rdash-exports.js
    event.reports.by_month.title = "Expenses By Month";
    event.reports.cost_share_detail.title = "Cost Share Detail";
    event.reports.payments.title = "Payments";
    event.reports.subcontracts.title = "Subcontracts";

    // set the filename for the Excel export
    // auto generate a filename based on the username
    function makeFilename(project_id){
      var date = dateFormat(Date.now(), "isoDateTime");
      return "ResearchPortal_SponsoredProject_" + (project_id || "report") + "." + date + ".xlsx";
    }
    event.filename = makeFilename(project_id);

    // ProjectExport.generateExcelPivot(event, handleResponse);
    ProjectExport.generateExcelSponsored(event, handleResponse);
  }

  // Initiate the async processing. Call 'complete' on completion.
  async.map(inputs, process, complete);
}


function generateNonSponsoredProjectReport(req, config, handleResponse){
  var project_id = req.params.querystring.p_PrjID || "n/a";
  var fund_code = req.params.querystring.p_FundCode || "n/a";
  var dept_id = req.params.querystring.p_DeptID || "n/a";
  var chart_string = [fund_code, dept_id, project_id].join('_');

  var overview_opts = JSON.parse(JSON.stringify(req));
  overview_opts.params.querystring.selection = "RD004";

  var itd_opts = JSON.parse(JSON.stringify(req));
  itd_opts.params.querystring.selection = "RD005";

  // map the list of input data to be processed asynchronously.
  var inputs = [overview_opts, itd_opts];

  function process(input, callback){
    ContentService.get(input, config, function(err, response, data){
      if (err){
        callback(err);
      } else {
        callback(null, data);
      }
    });
  }



  // Callback for completion (after all tasks have comlpeted)
  // result: [result1, result2, result3, result4];
  function complete(err, result){

    var overview_data = result[0];
    var itd_data = result[1];

    var event = {
      report_title: "Non Sponsored Project Report (Project ID: "+ project_id + ")",
      reports: {
        non_sponsored_overview: overview_data,
        non_sponsored: itd_data
      }
    }
    event.reports.non_sponsored_overview.title = "Overview ";
    event.reports.non_sponsored.title = "ITD";

    // set the filename for the Excel export
    // auto generate a filename based on the username
    function makeFilename(chart_string){
      var date = dateFormat(Date.now(), "isoDateTime");
      return "ResearchPortal_NonSponsoredProject_" + (chart_string || "report") + "." + date + ".xlsx";
    }
    event.filename = makeFilename(chart_string);
    ProjectExport.generateExcelNonSponsored(event, handleResponse);
  }

  // Initiate the async processing. Call 'complete' on completion.
  async.map(inputs, process, complete);
}

function setTransactionsProducer(req, config, handleResponse){
  var sso_token = req.params.querystring.sso_token;
  var netid = req.params.querystring.p_Invest_ID;
  var role_opts = {
      'stage-vars': {
        env: req["stage-vars"]["env"]
      },
      params: {
        querystring:{
          selection: "RD014",
          esb_path: "RP_LandingPage",
          sso_token: sso_token,
          p_Invest_ID: netid
        }
      }
    }
  ContentService.get(role_opts, config, function(err, response, data){
      if (err){
        handleResponse(null, null, "No role match error");
    } else {
      var first_row = data.rows[0] || {};
      var role = first_row['RESEARCHER_ACCESS'] || "";
      if(role==='N'){
      netid = "Research Portal Staff"
    }else if(role===""){
      handleResponse(null, null, "No role match");
    }
    UserService.getNetid(sso_token, function(err, response, userdata){
      if (err){
        handleResponse("Unable to load user metadata for the projection's author");
        return;
      } else {
        var streamdata = {
          env: req['stage-vars']['env'],
          project_id: req.params.querystring.p_PrjID,
          netid : netid,
          user : userdata.cn,
          email : userdata.mail
        };
        var params = {
          Records:[
            {
              Data:JSON.stringify(streamdata),
              PartitionKey: "transactionPartition"
            }
          ],
          StreamName: "amps-rdash-transactions"
        };
        kinesis.putRecords(params, function(err, data) {
          if (err){
            console.log(err, err.stack); // an error occurred
            handleResponse(err);

          } else {
            console.log(data);
            handleResponse(null,null, data);
        // successful response
          }
        });
      }

    })
  }
})

}

// 'router' for reports.
function get(req, config, handleResponse){
  var project_type = req.params.querystring.project_type;
  switch(project_type){
    case 'sponsored':
    generateSponsoredProjectReport(req, config, handleResponse);
    break;
    case 'non-sponsored':
    generateNonSponsoredProjectReport(req, config, handleResponse);
    break;
    case 'sponsored-transactions':
    setTransactionsProducer(req, config, handleResponse);
    break;
    default:
    generateUserProjectPortfolio(req, config, handleResponse);
    break;
  }

}

module.exports = {
  get: get
};


// Excel Prep Schema
// var event = {
//   report_title: "User Project Portofolio",
//   reports: {
//     sponsored: {
//       headers: ['name'],
//       rows: [{
//         name:'foo bar'
//       }],
//       sheet_name: 'sponsored'
//     },
//     non_sponsored: {
//       headers: ['name'],
//       rows: [{
//         name:'foo bar'
//       }],
//       sheet_name: 'non_sponsored'
//     },
//     pending: {
//       headers: ['name'],
//       rows: [{
//         name:'foo bar'
//       }],
//       sheet_name: 'pending'
//     }
//   }
// }
