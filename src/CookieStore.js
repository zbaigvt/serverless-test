
function CookieStore(cookieStr){
  var list = {}
  this.cookies = cookieStr.split("; ").forEach(function(it){
    var tokens = it.split("=");
    list[tokens[0]] = decodeURI(tokens[1]);
  })
  this.list = list;
}
CookieStore.prototype.get = function(name){
  return name in this.list ? this.list[name] : null;
}
CookieStore.prototype.keys = function(){
  return Object.keys(this.list);
}

module.exports = CookieStore;
