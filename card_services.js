
var yaml_config = require('node-yaml-config');
var config = yaml_config.load('./config/config.yml');
var latest = require('./latest.js');

module.exports = {

  link_new_card_screen: function (mainWindow, message) {


    latest = []
    latest.push('file://' + __dirname + '/app/link_new_card.html');
    mainWindow.loadURL(latest[0]);
    if (typeof message  !== 'undefined') {
      mainWindow.webContents.once('did-finish-load', () => {

        mainWindow.webContents.send('present-flash', message);
        message = null;
      });
    } else {

    }
    console.log('exiting link_new_card_screen');
    return;
  }
}
