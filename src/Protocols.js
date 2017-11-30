var request = require("request").defaults({
  jar: true
})
var CONFIG = require("./config.js");
var ConfigLoader = require("./config-loader.js")
var AWS = require("aws-sdk");
var async = require("async");


function get(req, config, callback) {
  var env = req['stage-variables'] ? req['stage-variables']['env'] : req['stage-vars']['env']

  var service = req.params.querystring.service
  if (service === "byNetID") {
    var urls = CONFIG.environments[env]["PROTOCOLS_NetID_URLS"]
    urls = urls.map(url => {
      return url + req.params.querystring.queryid
    })
    // var urls = ['https://coitest.northwestern.edu/test/PublicCustomLayouts/WSTest','https://coitest.northwestern.edu/test/PublicCustomLayouts/WSTest']
    async.map(urls, queryprotocol, function done(err, data) {
      if (err) {
        console.log("ERR", err);
        callback(err);
      } else {
        var items = {}
        items.iacuc = data[0].data ? data[0].data : []
        items.irb = data[1].data ? data[1].data : []
        callback(null, null, items);
      }
    })
  }
  if (service === "IACUCProID") {
    var url = CONFIG.environments[env]['IACUCProID_URL']
    var id = req.params.querystring.protocol_id
    url = url + id
    // var url = 'https://coitest.northwestern.edu/test/PublicCustomLayouts/WSTest'
    queryprotocol(url, function(err, data) {
      if (err) {
        console.log("ERR", err);
        callback(err);
      } else {
        callback(null, null, data.data);
      }
    })
  }
  if (service === "IRBProID") {
    var url = CONFIG.environments[env]['IRBProID_URL']
    var id = req.params.querystring.protocol_id
    url = url + id
    // var url = 'https://coitest.northwestern.edu/test/PublicCustomLayouts/WSTest'
    queryprotocol(url, function(err, data) {
      if (err) {
        console.log("ERR", err);
        callback(err);
      } else {
        callback(null, null, data.data);
      }
    })

  }
}

function queryprotocol(url, callback) {
  var ORIT_SECRET = "./secure/ORIT-secret";
  ConfigLoader.decrypt(ORIT_SECRET, AWS, function(err, data) {
    var opts = {
      'url': url,
      'headers': {
        'ORIT-API-KEY': data["ORIT-API-KEY"]
      }
    }
    request.get(opts, function(err, response, body) {
      if(response.headers['content-type'].indexOf('text/html')>=0){
        var res = {}
        res.data = body
        callback(err, res);
      } else{
        callback(err, JSON.parse(body));
      }

    })
  });
}


module.exports = {
  get: get
}
