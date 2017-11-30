var Dictionary = require('./Dictionary.js');
var nodeExcel = require('excel-export');

var fs = require('fs');
var AWS = require('aws-sdk');

// Local Development: set this to false;
// AWS - set this to true.
var USE_CONTEXT_SIMPLE = true;

//Dictionary
// constants
var currency_keys = [
  "Amount",
  "BALANCE",
  "BUDGET",
  "ENCUMBERED",
  "_PROJECTED",
  "PROJECTIONS",
  "ACTUAL",
  "ACTUAL EXPENSE",
  "FYTD_ACTUAL_EXPENSE",
  "FYTD_PRE_ENC_ENC_EXPENSE",
  "CURRENT_EXPENSE_BUDGET",
  "EXPENSE_BUDGET_BALANCE",
  "REVENUE_LESS_EXPENSE"
];


// initialize the dictionary
// function before(callback){
//   Dictionary.load(callback);
// }



// serches for a simplified header in the header_dict
// if it does not exists it searches Dictionary.js
function getDefinition(selection, column_name, format){
  // if (selection in header_dict){
  //   if(column_name in header_dict[selection]){
  //     return header_dict[selection][column_name][format];
  //   }
  // }
  switch(format){
    case "long_description":
    return Dictionary.formatTitle(column_name, selection);
    break;
    case "short_description": // deliberate fall-through
    default:
    return Dictionary.formatLabel(column_name, selection);
    break;
  }
}

// month addition
function addMonths(year, month, n_months){
  month+=n_months;
  while(month > 12){
    year++;
    month-=12;
  }
  while(month < 1){
    year--;
    month+=12;
  }
  return [year, month];
}


function pad (value, length){
  return (value.toString().length < length) ? pad("0"+value, length):value;
}

var output_cols = []; // keeps track of ranges of dates


// input:
// Object {headers: Array[7], rows: Array[50]}
// output:
// headers:
// Object {headers: Array[1..60], rows: Array[13]}
// Takes project start and end dates and shows 3 months of data before and after those times
function pivotData(data, yyyy, mm, start, end){
  // Get date from user input
  if (data.rows.length < 1){
    console.log("No rows found");
    return;
  }

  // align to fiscal dates
  var d = addMonths(yyyy,mm, +5);
  var yyyy = d[0];
  var mm = d[1];

  // set cols, rows
  var columns = ["ACCOUNT CATEGORY DESCR"];

  // grab startng date
  var start_year = start.split("-")[0];
  var start_month = start.split("-")[1].split("-")[0];

  // grab ending date
  var end_year = end.split("-")[0];
  var end_month = end.split("-")[1].split("-")[0];

  // create desired time frame to be written
  var start_d = addMonths(parseInt(start_year), parseInt(start_month), 1);
  var start_yyyy = start_d[0];
  var start_mm = start_d[1];

  var end_d = addMonths(parseInt(end_year), parseInt(end_month), 4);
  var end_yyyy = end_d[0];
  var end_mm = end_d[1];

  // turn start and end dates into ints used for comparison
  if (start_mm.length < 2){
    start_mm = '0' + start_mm;
  }
  start_mm = "" + start_mm;

  if (end_mm.length < 2){
    end_mm = '0' + end_mm;
  }
  end_mm = "" +end_mm;

  var range_start = parseInt(start_yyyy + pad(start_mm,2));
  var range_end = parseInt(end_yyyy + pad(end_mm, 2));

  var n_months = 60;
  // generate column keys for the selected date.
  for(var i=0; i< n_months; i++){
    var offset = 1 - n_months + i;
    var d = addMonths(yyyy, mm, offset);
    var date_str = d[0] + " - " + pad(d[1], 2);
    if (String(d[1]).length === 1){
      d[1] = 0 + String(d[1]) ;
    }
    var cur_date = String(d[0]) + String(d[1]);
    // check if the current date is in the desired range
    if (parseInt(cur_date) <= range_end && parseInt(cur_date) >= range_start){
      columns.push(date_str);
    }
  }
  data.columns = columns;
  output_cols = columns;

  var cat_names = [];
  data.rows.forEach(row => {
    var value = row['ACCOUNT CATEGORY DESCR'];
    if (cat_names.indexOf(value)<0){
      cat_names.push(value);
    }
  });

  // generate rows.
  var rows = cat_names.map(cat => {
    var list = data.rows.filter(row => {
      var sel_cat = row['ACCOUNT CATEGORY DESCR'] === cat;
      var sel_date = columns.indexOf(row['Fiscal Year - Accounting Period'] >= 0)
      return sel_cat && sel_date;
    });

    var new_row = {};
    new_row['ACCOUNT CATEGORY DESCR'] = cat;
    list.forEach(row => {
      var key = row['Fiscal Year - Accounting Period'];
      var val = parseFloat(row['ACTUAL EXPENSE']);
      new_row[key] = val;
    })

    for (i=0; i<output_cols.length; i++){
      if(new_row[output_cols[i]] == undefined){
        new_row[output_cols[i]] = 0;
      }
    }
    return new_row;
  })
  return {
    headers: columns,
    rows: rows
  }
}

// pivots data for project overviews returning rows as arrays of
// length 2 ['FUND_DESCR', 4242.42]
function pivotOverviewData(data){
  if (data.rows.length < 1){
    console.log("No rows found");
    return;
  }

  var keys = Object.keys(data.rows[0]);

  var output_rows = keys.map(function(key){
    var row = [key, data.rows[0][key]];
    return row;
  });

  return{
    headers: data.headers,
    rows: output_rows
  }
}

// prepares non-sponsored data to be written in generateExcel
function generateExcelNonSponsored(data, context){
  if(data.reports.non_sponsored_overview.rows.length > 0){
    var pivoted_data_overview = pivotOverviewData(data.reports.non_sponsored_overview);
    data.reports.non_sponsored_overview.headers = pivoted_data_overview.headers;
    data.reports.non_sponsored_overview.rows = pivoted_data_overview.rows;
  } else {
    console.log("generateExcelNonSponsored - no rows found");
    data.reports.non_sponsored_overview.headers = [];
    data.reports.non_sponsored_overview.rows = [];
  }

  //@TODO: define 'enums' for this
  var mode = 'ns'; //ns === non-sponsored mode
  generateExcel(data, context, mode);
}

// prepares sponsored data to be written in generateExcel
function generateExcelSponsored(data, context){
  //  initialize the dictionary -- fetch remote data.

    // pivot the data that needs to be pivoted (by_month, project_overview)
    if (data.reports.by_month.rows.length !== 0){
      // Dynamically generate today's date as the further right column .
      var date = new Date();
      var year = date.getFullYear();
      var month = date.getMonth();

      var pivoted_data_bymonth = pivotData(data.reports.by_month, year, month, data.reports.project_overview.rows[0]['PROJECT START DATE'], data.reports.project_overview.rows[0]['PROJECT END DATE']);

      data.reports.by_month.headers = pivoted_data_bymonth.headers;
      data.reports.by_month.rows = pivoted_data_bymonth.rows;

      if (data.reports.project_overview.rows.length !== 0){
        var pivoted_data_overview = pivotOverviewData(data.reports.project_overview);
        data.reports.project_overview.headers = pivoted_data_overview.headers;
        data.reports.project_overview.rows = pivoted_data_overview.rows;
      }
      if (data.reports.by_month.rows.length === 0) {
        console.log("generateExcelSponsored - no rows found for by month");
        data.reports.by_month.headers = [];
        data.reports.by_month.rows = [];
      }
      if (data.reports.project_overview.rows.length === 0){
        console.log("generateExcelSponsored - no rows found for project overview");
        data.reports.project_overview.headers = [];
        data.reports.project_overview.rows = [];
      }
      if (data.reports.payments.rows.length === 0){
        console.log("generateExcelSponsored - no rows found for payments");
        data.reports.payments.headers = [];
        data.reports.payments.rows = [];
      }
      if (data.reports.subcontracts.rows.length === 0){
        console.log("generateExcelSponsored - no rows found for subcontracts");
        data.reports.subcontracts.headers = [];
        data.reports.subcontracts.rows = [];
      }
      var mode = 's'; // s === sponsored mode
      generateExcel(data, context, mode);
    }
}

/**
* event - AWS Lambda event from API Gateway
*   {
*      "filename": "Sponsored.ProjectID.Date.xlsx"
*   }
*/
function generateExcel(event, context, mode){
  // var event.filename; // this is the output file name that will be passed in
  var excel_mode = mode;
  // input: excelData
  // {}

  // uploads file to S3.
  // Input:
  // {}
  function uploadData(excelData, filename) {
    // console.log("Uploading");
    AWS.config.region = 'us-east-1';
    var s3 = new AWS.S3();
    var S3_BUCKET_NAME = "amps-rdash-exports";

    var params = {Bucket: S3_BUCKET_NAME, Key: filename, Body: excelData};

    s3.putObject(params, function(err, data) {
      if (err) {
        console.log("Saving Data Exports Error",err);
        context(err);
      } else {
        var url = s3.getSignedUrl('getObject', {Bucket: S3_BUCKET_NAME, Key: filename, Expires: 120});
        console.log("Successfully uploaded data to", S3_BUCKET_NAME + "/" + filename);
        context(null, null, url);
      }
    });
  }
  //writes to file according to passed mode
  function writeDataLocally(excelData, filename) {
    try {
      if (excel_mode === 's'){
        fs.writeFileSync('Sponsored_Data_Portfolio.xlsx', excelData, 'binary');
        if (!USE_CONTEXT_SIMPLE){
          context.succeed("Successfully wrote to file: Sponsored_Data_Portfolio.xlsx");
          context.done();
        } else {
          context(null, null, "Successfully wrote to file: Sponsored_Data_Portfolio.xlsx");
        }
      }
      else if (excel_mode === 'ns'){
        fs.writeFileSync('Non_Sponsored_Data_Portfolio. xlsx', excelData, 'binary');
        if (!USE_CONTEXT_SIMPLE){
          context.succeed("Successfully wrote to file: Non_Sponsored_Data_Portfolio.xlsx");
          context.done();
        } else {
          context(null, null, "Successfully wrote to file: NonSponsored_Data_Portfolio.xlsx");
        }
      }
      else{
        throw Error("This mode doesn't exist...");
      }
    }

    catch(err) {
      if (!USE_CONTEXT_SIMPLE){
        context.succeed("Failed writing to file, error:" + err);
        context.done();
      } else {
        context(null, null, "Failed writing to file, error:" + err);
      }
    }
  }

  function parseToXLSX(event, cb) {
    var reports = event.reports;
    if (excel_mode === 's'){

      // create new json object with all of this new data
      var ITD = {
        title: 'Inception to Date',
        headers: ["ACCOUNT_CATEGORY_DESCR","ACTUAL","ENCUMBERED","BUDGET","BALANCE","_PROJECTED"],
        // rows: new_itd_rows,
        projections: reports.inception_to_date.projections,
        selection: reports.cost_share_detail.selection
      }
      ITD.rows = reports.inception_to_date.rows.map(function(row){
        var out = {};
        ITD.headers.forEach(function(key){
          out[key] = row[key];
        })
        return out;
      })

      var cost_share_detail = {
        title: 'Cost Share Detail',
        headers: ['FUND_DESCR', 'ACCOUNT_CATEGORY_DESCR', 'BUDGET', 'ACTUAL', 'ENCUMBERED' ,'BALANCE'],
        // rows: new_cs_rows,
        selection: reports.cost_share_detail.selection
      }
      cost_share_detail.rows = reports.cost_share_detail.rows.map(function(row){
        var out = {};
        cost_share_detail.headers.forEach(function(key){
          out[key] = row[key]
        })
        return out;
      });

      var new_overview_rows = [];
      reports.project_overview.rows.forEach(function(entry){
        if (entry[0] === 'PROJECT END DATE' || entry[0] === 'PROJECT START DATE'){
          entry[1] = entry[1].split("T")[0];
        }
        new_overview_rows.push(entry);
      });

      reports.project_overview.rows = new_overview_rows;

      reports.payments.rows.forEach(function(row){
        row['DEPOSIT_DATE'] = row['DEPOSIT_DATE'].split('T')[0];
        row['POSTED_DATE'] = row['POSTED_DATE'].split('T')[0];
      });

      // reports.transactions.rows.sort((a,b) =>{
      //   if(a['TRANSACTION_SOURCE'] > b['TRANSACTION_SOURCE']){
      //     return -1;
      //   } else if( a['TRANSACTION_SOURCE'] < b['TRANSACTION_SOURCE']){
      //     return 1;
      //   } else {
      //     return a['Account Code']>=b['Account Code'] ? -1:1
      //   }
      // })

      var tabs = [
        reports.project_overview,
        ITD,
        reports.by_month,
        cost_share_detail,
        reports.payments,
        reports.subcontracts
        // reports.transactions
      ];
    } else if (excel_mode === 'ns'){
      // create new dataTop object and filter keys
      var top_row = {};
      top_row_enc = {}
      reports.non_sponsored.rows.forEach(function(entry){
        if (Array.isArray(entry) === false){

          if (entry['ACCOUNT_DESCR'] === 'Total'){
            reports.non_sponsored.rows.splice(reports.non_sponsored.rows.indexOf(entry), 1);
            top_row['ACCOUNT_DESCR'] = entry['ACCOUNT_DESCR'];
            top_row_enc['FYTD_PRE_ENC_ENC_EXPENSE'] = entry['FYTD_PRE_ENC_ENC_EXPENSE'];
            dataTop = {
              title: "Totals",
              headers: ['ACCOUNT_DESCR', 'FYTD_PRE_ENC_ENC_EXPENSE'],
              rows: [top_row, top_row_enc]
            }
          }
        }
      });

      desired_headers_top = ["ACCOUNT_DESCR","NET_BUDGET", "REVENUE_LESS_ACTUAL", "FYTD_PRE_ENC_ENC_EXPENSE",  "NET_BALANCE"]; // data to be displayed in xlsx file
      new_headers = reports.non_sponsored_overview.headers.filter(function(entry){
        if (desired_headers_top.indexOf(entry) != -1){
          return entry;
        }
      });
      // make new row dictionary with desired values to be written
      var new_top_rows = [];
      var top_row_dict = {};
      top_row_dict['ACCOUNT_DESCR'] = 'Total';
      reports.non_sponsored_overview.rows.forEach(function(entry){
        if(desired_headers_top.indexOf(entry[0]) != -1){
          top_row_dict[entry[0]] = entry[1]
        }
      });

      top_row_dict['FYTD_PRE_ENC_ENC_EXPENSE'] = top_row_enc['FYTD_PRE_ENC_ENC_EXPENSE'];
      new_top_rows.push(top_row_dict);

      dataTop.rows = new_top_rows;

      new_headers.unshift(dataTop.headers[0]);
      new_headers.push(dataTop.headers[1]);

      dataTop.headers = new_headers;

      // filter out data shown in non sponsored project overview
      new_overview_headers = []; // actulaly rows b/c of pivot
      desired_overview_headers = ["PRJ_SD", "FY_START_DT", "FY_END_DT"]; //Rows to be displayed in xlsx file

      new_overview_headers = reports.non_sponsored_overview.rows.filter(function(entry){
        if (desired_overview_headers.indexOf(entry[0]) != -1){
          if (entry[0] === "FY_START_DT" || entry[0] === "FY_END_DT"){ // format dates
            entry[1] = entry[1].split("T")[0];
            return entry;
          }
          else{
            return entry;
          }
        }
      });

      // configure chart string
      var chart_string = {};

      reports.non_sponsored_overview.rows.forEach(function(entry){
        if (entry[0] === 'FUND_CODE'){
          chart_string['FUND_CODE'] = entry[1];
        }
        if (entry[0] === 'DEPT_ID'){
          chart_string['DEPT_ID'] = entry[1];
        }
        if (entry[0] === 'PRJ_ID'){
          chart_string['PRJ_ID'] = entry[1];
        }
      });

      new_overview_headers.push(['Chart String', chart_string['FUND_CODE'] + '-' + chart_string['DEPT_ID'] + '-' + chart_string['PRJ_ID']]);

      reports.non_sponsored_overview.rows = new_overview_headers;

      var new_bottom_rows = [];

      // filter out unwanted data and create a new rows dictionary
      reports.non_sponsored.rows.forEach(function(entry){
        var new_itd_dict = {};
        new_itd_dict['ACCOUNT_DESCR'] = entry['ACCOUNT_DESCR'];
        new_itd_dict['FYTD_ACTUAL_EXPENSE'] = entry['FYTD_ACTUAL_EXPENSE'];
        new_itd_dict['FYTD_PRE_ENC_ENC_EXPENSE'] = entry['FYTD_PRE_ENC_ENC_EXPENSE'];
        new_itd_dict['CURRENT_EXPENSE_BUDGET'] = entry['CURRENT_EXPENSE_BUDGET'];
        new_itd_dict['EXPENSE_BUDGET_BALANCE'] = entry['EXPENSE_BUDGET_BALANCE'];
        new_bottom_rows.push(new_itd_dict);
      });

      // create new json object with all of this new data
      var dataBottom = {
        title: 'ITD',
        headers: ["ACCOUNT_DESCR", "FYTD_ACTUAL_EXPENSE", "FYTD_PRE_ENC_ENC_EXPENSE", "CURRENT_EXPENSE_BUDGET", "EXPENSE_BUDGET_BALANCE"],
        rows: new_bottom_rows
      }

      var tabs = [reports.non_sponsored_overview, dataBottom, dataTop];
    }else{
      throw ("This mode does not exist ...");
    }

    var configs = [];
    var count = 0;
    if (!tabs || tabs.length==0) {
      throw new Error("Missing Data");
    }
    tabs.forEach(function(json){
      if (!json || json.length==0) {
        console.log(json);
        throw new Error("Missing Data/Invalid json object:");
      }

      count++;

      if (json.title == "Project Header") {
        parseProjectHeader(json);
        return;
      }

      var conf ={};
      if (json.hasOwnProperty('title')) {
        var title = json.title.toString().replace(/ /g, '').substring(0,30);
        // console.log(title);
        conf.name = title;
      }
      else {
        conf.name = "Sheet" + String(count);
      }

      conf.cols = [];
      if (!json.hasOwnProperty('headers')) {
        throw new Error("Missing headers in json file:" + conf.name)
      }

      // project overviews *only*
      if (json.rows.length > 0 && 'length' in json.rows[0] && json.rows[0].length === 2){
        var tmp = json.rows[0];
        console.log('length' in tmp, Object.keys(json));
        conf.cols.push({
          caption: "Description",
          type: 'string'
        });
        conf.cols.push({
          caption: 'Value',
          type: 'string'
        });
      } else {
        var headers = json.headers || [];
        // console.log(headers);
        headers.forEach(function(key) {
          // console.log(key);
          var type;
          // if the column name is a known currency column name, OR
          // a month-day combo in the expenses by month, set the type of the
          // column to number
          if (key.match(/\d{4} - \d{2}/) || currency_keys.indexOf(key) >= 0){
            type = 'number';
          }else {

            type = 'string';
          }
          // if it is non sponsored mode grab the headers from 'RD004' no matter what
          if (excel_mode === 's'){
            var new_key = getDefinition(json.selection ,key,'short_description');
          }
          else{
            var new_key = getDefinition('RD004', key, 'short_description');
          }
          conf.cols.push({
            caption: new_key,
            type: type
          });
        });
      }
      // set the width on the first column for all tables
      if (conf.cols.length){
        conf.cols[0].width = 150; // pixels ?
      }

      // grab procjections and add them to rows dict
      if(json.hasOwnProperty('projections')){

        var proj = json.projections;
        var projections = {}

        proj.forEach(function(entry){
          acc_code = entry['ACCOUNT_CATEGORY_CODE'];
          val = entry['value'];
          projections[acc_code] = val;
        });
      }

      conf.rows = [];
      var row = [];

      // get simplified description for the headers of overivews (overviews' rows will be arrays)
      if (!json.hasOwnProperty('rows')) {
        throw new Error("Missing rows in json file" + conf.name);
      }

      json.rows.forEach(function(rowValues) {
        if (Array.isArray(rowValues)){
          rowValues[0] = getDefinition(json.selection,rowValues[0],'short_description');
          row = rowValues;
        }
        else{
          // projections calculations
          if (json.hasOwnProperty('projections')){
            var saved_acc_code_val = 0;
            if (rowValues['ACCOUNT_CATEGORY_CODE'] in projections){
              rowValues["_PROJECTED"] = projections[rowValues['ACCOUNT_CATEGORY_CODE']];
              saved_acc_code_val = projections[rowValues['ACCOUNT_CATEGORY_CODE']];
            }
            else{
              rowValues["_PROJECTED"] = 0;
              saved_acc_code_val = 0;
            }
          }
          var row = [];
          json.headers.forEach(function(col){
            if (col === 'BALANCE' && json.hasOwnProperty('projections')){
              rowValues[col] = rowValues[col] - saved_acc_code_val;
            }

            // add missing cells for rows with missing 'column'
            if (output_cols.indexOf(String(col)) != -1 || String(col).match(/[a-z]/i)){
              row.push((rowValues[col] || 0));
            }

          });
        }
        conf.rows.push(row);
      });

      // display message when there are no rows.
      if (json.rows.length === 0){
        var empty_row = [];
        var NOT_AVAILABLE_STRING = "n/a";
        json.headers.forEach(function(key){
          empty_row.push(NOT_AVAILABLE_STRING);
        })
        conf.rows.push(empty_row);
        // set the column type ot 'string' so that we can add text.
        conf.cols.forEach(function(col){
          col.type = 'string';
        })
      }

      configs.push(conf);
    });

    function parseProjectHeader(json) {
      var conf = {};
      conf.name = "ProjectHeader";
      conf.cols = [];
      conf.cols.push({caption:'Name',type:'string'});
      conf.cols.push({caption:'Value',type:'string'});
      conf.rows = [];

      var jsonRow = json.rows[0];
      Object.keys(jsonRow).forEach(function(col,index) {
        conf.rows.push([col, jsonRow[col]]);
      });
      configs.push(conf);
      //console.log("conf", conf);
    }

    // pass this from the 'event'
    var filename = event.filename;

    // main entry point
    var data = nodeExcel.execute(configs);

    if (cb.name === 'writeDataLocally') {
      cb(data, filename);
    } else {
      var binaryData = new Buffer(data, 'binary');
      cb(binaryData, filename);
    }
  }

  // uncomment/comment to change write mode
  // parseToXLSX(event, writeDataLocally);
  parseToXLSX(event, uploadData);
};

module.exports = {
  generateExcel: generateExcel, // @TODO: refactor this form the ExcelExports.js
  generateExcelSponsored: generateExcelSponsored,
  generateExcelNonSponsored: generateExcelNonSponsored,
  pivotData: pivotData
}
