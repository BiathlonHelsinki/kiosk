var tcpp = require('tcp-ping');
var yaml_config = require('node-yaml-config');
var config = yaml_config.load('./config/config.yml');
var latest = require('./latest.js');
const util = require('util')

module.exports = {
  is_api_online: function (mainWindow, callback) {

    tcpp.probe(config.api, config.port,  function(err, data) {
      if (data == true) {

        if (latest.thearray.slice(-1)[0]  == 'offline') {
          latest.thearray.pop();
          if (latest.thearray[0] != undefined) {
            mainWindow.loadURL(latest.thearray[0]);
            callback()
          }
        }
      } else {

        if (latest.thearray.slice(-1)[0]  != 'offline') {
          latest.thearray.push('offline');
        }
        mainWindow.loadURL('file://' + __dirname + '/app/themes/' + config.theme + '/kiosk_offline.html');
      }
    });
  }
};
