var request = require("request");
var DateUtils  = require("./DateUtils.js");
var AWS = require("aws-sdk");
var CONFIG = require("./config.js");

// AWS Settings
AWS.config.update({
  region: 'us-east-1'
});

// s3 instance
var s3 = new AWS.S3();


// IBM data dictionary
// var dict = {};
var dict = {
  data: {} // this is required!
};
var is_loading = false;

// callback(error, response, data);
function load(callback){
  is_loading = true;
  //@TODO: Use the correct ['stage-vers']['env'] once the IBM dictionary proxy is moved to Stage/Prod.
  var url = "https://api.researchportal.northwestern.edu/prod/api/v1/dictionary";

  var opts = {
    url : url,
    methods: "GET"
  }
  request(opts, function(err, response, data){
    if (err){
      is_loading = false;
      console.log("Error loading IBM dictionary.", err);
      console.log("Using local fallback copy of the dictionary");
      dict.data = require("./dictionary-data-fallback.js");
      callback(err);
    } else {
      dict.data = JSON.parse(data);
      is_loading = false;
      console.log("Loaded IBM data dictionary");
      callback(null, null, dict);
    }
  });
}



// Generate the filename for the investigators file on S3
// based on the environment
function getS3FilePath(env){
  var prefix = env + "/DICTIONARY/";
  var filename = prefix + "dictionary.json";
  return filename;
};

// store blob of data to S3S
// callback(error, data);
function storeToS3(env, data, callback){
  callback(new Error("Not implemented"));
}


/**
* Returns a list of CSS classes to be added
*/
function formatClass(key, row){
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

  var key_without_spaces = key.replace(/ /g, '_');
  var classes = [key_without_spaces];
  // is currency?
  // ALSO, in the month-by-month, the columns will be '2016 - 03'.
  if (currency_keys.indexOf(key)>=0 || key.match(/^\d{4} - \d{2}$/)){
    classes.push('currency');
    var value = parseFloat(row[key]);
    // is negative?
    if (value < 0.0){
      classes.push('negative');
    }
    // is zero?
    if (value === 0.0){
      classes.push('zero');
    }
  }
  return classes.join(" ");
}

function _formatCurrency(value){
  var USE_THE_INLINE_DOLLAR_SIGN = false;
  if (USE_THE_INLINE_DOLLAR_SIGN){
    return "$ " + accounting.formatNumber(value, 2);
  } else {
    return accounting.formatNumber(value, 2);
  }
}


/**
* Supports computed values.
*/
function formatValue(key,row){
  // set default value for row to empty object.
  row = row || {};
  // short-circuit for date (yyyy-mm)
  if (key.match(/^\d{4} - \d{2}$/)){
    var value = row[key];
    var n = parseFloat(value);
    return _formatCurrency(n);
  }
  switch(key){
    case "profile_style":
    return;
    break;
    case "DATE": // computed value
    var dt_start = this.formatValue("PROJECT START DATE", row);
    var dt_end = this.formatValue("PROJECT END DATE", row);
    return dt_start + " to " + dt_end;
    break;
    case "Amount":    // deliberate fall-through
    case "ACTUAL":     // deliberate fall-through
    case "ACTUAL EXPENSE":     // deliberate fall-through
    case "BALANCE":    // deliberate fall-through
    case "BUDGET":     // deliberate fall-through
    case "NET_BUDGET":     // deliberate fall-through
    case "CURRENT_EXPENSE_BUDGET":  // deliberate fall-through
    case "ENCUMBERED": // deliberate fall-through
    case "EXPENSE_BUDGET_BALANCE":  // deliberate fall-through
    case "FYTD_ACTUAL_EXPENSE":  // deliberate fall-through
    case "FYTD_PRE_ENC_ENC_EXPENSE":  // deliberate fall-through
    case "FYTD_ACTUAL_REVENUE": // deliberate fall-through
    case "REVENUE_LESS_EXPENSE": // deliberate fall-through
    case "REVENUE_LESS_ACTUAL": // deliberate fall-through
    case "_PROJECTED": // deliberate fall-through
    case "TOTAL PAYMENTS APPLIED": // deliberate fall-through
    var value = row[key];
    var n = parseFloat(value);
    return _formatCurrency(n);
    break;
    case "Date":  // deliberate fall-through
    case "PROJECT START DATE": // deliberate fall-through
    case "PROJECT END DATE": // deliberate fall-through
    case "PROJECT_END_DATE": // deliberate fall-through
    case "DATE_SUBMITTED": // deliberate fall-through
    case "PROJECT_YEAR_END": // deliberate fall-through
    case "PROJECT_REQUEST_START_DATE": // deliberate fall-through
    case "PROJECT_REQUEST_END_DATE": // deliberate fall-through
    var cleanupDate = function(str){
      return str.replace(/T.*$/, '');
    }
    return cleanupDate(row[key]);
    // return this.$options.filters.moment(row[key], dateFmt);
    break;
    default:
    var value = row[key];
    var NOT_IDENTIFIED = "[Not identified]";
    if (value === 'null'){
      return NOT_IDENTIFIED;
    } else {
      return value;
    }
    return row[key];
    break;
  }
}


function formatLabel(label, selection){
  // check if the label is a date!
  if (label.match(/\d{4} - \d{2}$/)){
    var yyyy = parseInt(label.match(/^\d{4}/).pop(), 10);
    var m = parseInt(label.match(/\d{2}$/).pop(), 10);
    var n_months_to_add = -4;
    var d = DateUtils.addMonths(yyyy,m,n_months_to_add);
    var month_name_idx = d[1] - 1;
    // var out = key + " | " + this.months[month_name_idx] + " " + d[0];
    // var out = this.months[month_name_idx] + " " + d[0];
    var out = DateUtils.MONTHS[month_name_idx] + " " + d[0];
    return out;
  };

  if (selection && selection in dict.data && label in dict.data[selection]){
    var short = dict.data[selection][label].short_description;
    return short;
  }

  var labels = {
    "Account Description": "Account",
    "ACCOUNT_CATEGORY_DESCR" : "Category",
    "ACCOUNT_DESCR" : "Category",
    "ACTUAL": "Actual",
    "ACCOUNT CATEGORY DESCR" : "Category",
    "AWARD ID": "Award ID",
    "BALANCE": "Balance",
    "BUDGET": "Budget",
    "CAMPUS_EMAIL" : "Email",
    "CURRENT_EXPENSE_BUDGET" : "Budget",
    "CURRENT_PROPOSAL_STATUS": "Status",
    "CHARTSTRING": "Chart String",
    "Date": "Budget Check Date",
    "DATE": "Project Dates",
    "DATE_SUBMITTED": "Date Submited",
    "DEPT_DESCR" : "Department",
    "ENCUMBERED": "Encumbered",
    "EXPENSE_BUDGET_BALANCE" : "Balance",
    "FACULTY_STAFF" : "Position",
    "FYTD_ACTUAL_EXPENSE" : "Actual",
    "FYTD_PRE_ENC_ENC_EXPENSE" : "Encumbered",
    "FUND DESCR" : "Account Name",
    "FUND_DESCR" : "Account Name",
    "INSTITUTION_NUMBER": "Institution #",
    "MAIN_PI": "Lead PI",
    "NET_BUDGET": "Net Budget",
    "NET_BALANCE": "Net Balance",
    "ORIGINATING SPONSOR" :"Originating Sponsor",
    "profile_style" : "",
    "_PROJECTED": "Projected",
    "PROJECT ID": "Project ID",
    "PROJECT_ID": "Project ID",
    "PROJECT_REQUEST_START_DATE": "Proposed Period Start",
    "PROJECT_REQUEST_END_DATE": "Proposed Period End",
    "PROPOSAL_TITLE": "Proposal Title",
    "RESEARCHER_NETID"  :"NetID",
    "REVENUE_LESS_ACTUAL": "Revenue Less Actual",
    "PRIMARY_FIRST_NAME" : "First Name",
    "PRIMARY_LAST_NAME" : "Last Name",
    "PROJECT_NAME": "Project",
    "PROJECT NAME": "Project",
    "PROJECT START DATE": "Project Start Date",
    "PROJECT_END_DATE": "Project End Date",
    "PROJECT END DATE": "Project End Date",
    "PRIMARY_ROLE" : "Role",
    "PROJECT ID": "Project ID",
    "PROJECT SPONSOR": "Project Sponsor",
    "REVENUE_LESS_EXPENSE": "Revenue - Actual",
    "RESEARCH ADMINISTRATOR": "Research Administrator",
    "SPONSOR": "Sponsor",
    "SPONSOR REFERENCE AWARD NUMBER": "Sponsor Reference Award Number",
    "TOTAL PAYMENTS APPLIED": "Total Payments Applied",
    "Transaction ID": "Reference"
  };
  return label in labels ? labels[label] : label;
}

// Dictionary of all terms
var terms = {};
var NOT_FOUND = null;
// set a definition. The data is a string.
function set(term, data){
  var key = makeKey(term);
  terms[key] = data;
}
// Make sure we can encode the TERM as lowercase encoded URI
function makeKey(term){
  return encodeURIComponent(term.toLocaleLowerCase());
}
// get a definition of a term.
function get(term){
  var key = makeKey(term);
  return key in terms ? terms[key] : NOT_FOUND;
}
// list all the terms in the dictionary.
function list(){
  return Object.keys(terms);
}


// clean up the response
function formatDictionaryResponse(response){
  var item_keys = ['long_description','short_description'];
  var _dict = {
    global: {}
  };

  response.items.forEach(function(item){
    var name = item._name;
    if (name.match(/\|/)){
      var selection_and_key = name.split("|");
      var selection = selection_and_key[0];
      var key = selection_and_key[1];
      if (!(selection in _dict)){
        _dict[selection] = {};
      }
      _dict[selection][key] = item;
    } else {
      _dict.global[name] = item;
    }
  })
  return _dict;
}

// Fetch Data Dictionary Items from IBM Data Dictionary.
function fetchRemote(req, config, callback){
  // Make Request
  // req = {
  //   'stage-vars': {
  //     env: 'dev|stage|prod'
  //   },
  //   params: {
  //     querystring: {
  //       sso_token: 'YOUR_SESSION',
  //       (other keys): (other values);
  //     }
  //   }
  // }
  // config {} = Has the credentials for basic auth
  // callback = function(err, data){};
  // sort out the correct URL for the environment dynamically form the API Gateway stage variables
  var env = req['stage-vars']['env'];

  // set the fall-back to point to production
  // var BASE_URL = "https://nusoa.northwestern.edu";
  // if we have that environment, update the base URL to it.
  if (!(env in CONFIG.environments)){
    callback("Invalid environment:");
    return;
  }
  var BASE_URL = CONFIG.environments[env]['DICTIONARY_URL'];

  // prepare the Basic Auth
  if (req.basic_auth){
    console.log("Setting Basic Auth for request");
    var auth = 'Basic ' + new Buffer(config.username + ":"+config.password).toString('base64');
  } else {
    console.log("not setting basic auth");
  }
  // prepare request payload
  // var url = BASE_URL + "/" + esb_path + "?async=off&" + query;
  var url = BASE_URL;

  var opts = {
    url : url,
  }

  //@TODO: Support Basic Auth.
  if (req.basic_auth){
    opts.headers = {
      "Authorization" : auth
    }
  }

  request.get(opts, function(err, response, body){
    //NOTE: The ESB does *not* return an error for Cognos errors.
    // we need to check the statusCode.
    // fail on HTTP codes 400 and higher.
    var statusCode = parseInt(response.statusCode);
    var HTTP_MAX_VALID_CODE = 400;
    // check for if we got HTML instead of JSON.
    // Typically, this is where Cognos errors appear.
    var canary = body.match(/DOCTYPE/);
    if (canary){
      callback(body);
    } else if (statusCode >= HTTP_MAX_VALID_CODE){
      callback(response.statusCode);
    } else {
      callback(err, response, formatDictionaryResponse(JSON.parse(body)));
    }
  });
}

module.exports = {
  fetch: fetchRemote,
  formatValue: formatValue,
  formatLabel: formatLabel,
  formatClass: formatClass,
  load: load,
  set: set,
  list: list,
  get: get,
  dict : dict
}
