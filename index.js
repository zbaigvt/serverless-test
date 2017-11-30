var app = require("./src/app.js");


// AWS Node JS
exports.handler = function(event, context){
  var DEBUG = false;
  // init
  if (DEBUG){
    app.routeDebug(event, context);
  } else {
    try {
      app.route(event, context);
    } catch (err){
      console.log("RDash Lambda Error", JSON.stringify(err));
    }
  }
};
