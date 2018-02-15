var Latest = module.exports = {
    thearray: [],
    ppush: function(x) {
      Latest.thearray.push(x);
    },
    ppop: function() {
      Latest.thearray.pop();
    }, 
    sslice: function(x) {
      Latest.thearray.slice(x);
    }
}