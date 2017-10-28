var tcpp = require('tcp-ping');
var yaml_config = require('node-yaml-config');
var config = yaml_config.load('./config/config.yml');
var latest = require('./latest.js');

module.exports = {
  is_api_online: function (mainWindow) {

    tcpp.probe(config.api, config.port,  function(err, data) {
      if (data == true) {
        if (latest.thearray.slice(-1)[0]  == 'offline') {
          latest.thearray.pop();
          mainWindow.loadURL(latest[0]);
        }
      } else {
        if (latest.thearray.slice(-1)[0]  != 'offline') {
          latest.thearray.push('offline');
        }
        mainWindow.loadURL('file://' + __dirname + '/app/offline.html');
      }
    });
  }
};
