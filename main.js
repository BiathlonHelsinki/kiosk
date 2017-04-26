'use strict';

var electron = require('electron');
var app = electron.app;
const ps = require('ps-node');
var BrowserWindow = electron.BrowserWindow;
var mainWindow = null;
var request = require("request");
var fs = require('fs');

var weblock = require('lockfile');
var globalShortcut = electron.globalShortcut;
// const Freefare = require('freefare/index');
// var nfc  = require('nfc').nfc, util = require('util');
var yaml_config = require('node-yaml-config');
var config = yaml_config.load('./config/config.yml');
var tcpp = require('tcp-ping');
var latest = [];
var ipcMain = electron.ipcMain;
const spawn = require('child_process').spawn;
let message = '';
// const SerialPort = require('serialport');
// let serialPort = new SerialPort('/dev/ttyUSB0', {
//          baudrate: 19200
//      });
// let Printer = require('thermalprinter');
const screensaver = './app/img/screensaver/';

let cardreader = null;



function check_lock() {
  weblock.check('webapi.lock', function(error, isLocked) {
    if (isLocked) {
      return true;
    } else {
      return false;
    }
  });
}

function get_reader_status(callback) {
  
  ps.lookup({
      command: 'ruby',
      arguments: '_tag.rb',
      }, function(err, resultList ) {
      if (err) {
        return err;
          // throw new Error( err );
      }
      else {
        if (resultList.length == 0) {
          return callback(false);
        }
        resultList.forEach(function( process ){
            if( process ){
              return callback(true);
            } else {
              return callback(false);
            }
          })
        }
  });
}

ipcMain.on('query-reader-status', (event, arg) => {

  get_reader_status(function(status) {

    event.sender.send('reader-reply', status);
  });
});

function kill_errant_rubies(startafter) {
  
  ps.lookup({
      command: 'ruby',
      arguments: '_tag.rb',
      }, function(err, resultList ) {
      if (err) {
          throw new Error( err );
      }
 
      resultList.forEach(function( process ){
          if( process ){
            ps.kill(process.pid);
          }
      });
  });
  if (startafter !== undefined) {
    console.log('restarting cardreader');
    get_reader_status(function(status) {
      // console.log('reader status is ' + status);
      mainWindow.webContents.send('reader-reply', status);
    });
    cardreader = setTimeout(start_cardreader, 3000);
  }
}

function start_cardreader(ooo, callback) {
;
  let cardreader = spawn(config.ruby, [ config.read_tag]);
  mainWindow.webContents.once('did-finish-load', () => {
    get_reader_status(function(status) {
      // console.log('reader status is ' + status);
      mainWindow.webContents.send('reader-reply', status);
    });
  });
  cardreader.stdout.on('data', function(data) {
    var res = data.toString().replace(/[\r\n]/g, "").split("---");
    let uid = res[0];
    let security_code = res[1];
    if (ooo == 'check_card') {
      query_user(uid, security_code, 'check', (checked) => {
        return callback(checked);
      });

    } else {
      return query_user(uid, security_code);
      // , null, (status) => {
      //   return callback(status);
      // });
    }
      
  });
  cardreader.stderr.on('data', function(data) {
      console.log('stderr: ' + data);
      if (/No compatible NFC readers found/.test(data.toString())) {
        mainWindow.webContents.send('reader-status', 'stopped, restarting');
        if (ooo !== undefined) {
          kill_errant_rubies('startafter');
        } else {
          kill_errant_rubies();
        }
        // setTimeout(start_cardreader, 2000);
      }

      //Here is where the error output goes
  });
  cardreader.on('close', function(code) {

      // console.log('closing code: ' + code);
      //Here you can get the exit code of the script
  });
  cardreader.on('error', function(err) {
    
    console.log('Oh noez, teh errurz: ' + err);

  });

}



require('electron-context-menu')({
    prepend: (params, browserWindow) => [{
        label: 'Rainbow',
        // only show it when right-clicking images 
        visible: params.mediaType === 'image'
    }]
});
 
function splash_screen() {
  latest = []
  mainWindow.loadURL('file://' + __dirname + '/app/splash.html');
  let screensaver_files = [];
  fs.readdir(screensaver, (err, files) => {
    files.forEach(file => {
      screensaver_files.push("img/screensaver/" + file);
      console.log(file);
    });
    mainWindow.webContents.once('did-finish-load', () => {
      mainWindow.webContents.send('send-screensaver-files', screensaver_files);
    });
  })
  
  
}
 
function is_api_online() {
  tcpp.probe(config.api, config.port,  function(err, data) {
    if (data == true) {
      if (latest.slice(-1)[0]  == 'offline') {
        latest.pop();
        mainWindow.loadURL(latest[0]);
      }
    } else {
      if (latest.slice(-1)[0]  != 'offline') {
        latest.push('offline');
      }
      mainWindow.loadURL('file://' + __dirname + '/app/offline.html');
    }
  });
}

function events_today(callback) {
  var url = 'http://' + config.api + ":" + config.port + '/events/today';
  
  return request.get({url: url, 
    json: true,
    headers: {"X-Hardware-Name": config.name, "X-Hardware-Token": config.token}},
    (error, response, body) => {
      if (!error && response.statusCode === 200) {
        return  callback(body.data);
      } else {
        return callback('Cannot get today\'s experiments, please try again later.');
      }
  });
}

ipcMain.on('just-linked-card', () => {
  let events = events_today((e) => {
    mainWindow.webContents.send('load-events', e);
  });
});

function query_user(tag_id, security_code, check_card, callback) {
  latest = []

  var url = 'http://' + config.api + ":" + config.port + '/nfcs/' + tag_id + '/user_from_tag';
  let events = events_today((e) => {
    request.get({url: url, 
      json: true,
      qs: {securekey: security_code },
      headers: {"X-Hardware-Name": config.name, "X-Hardware-Token": config.token}},
      function (error, response, body) {
        if (!error && response.statusCode === 200) {
          
          if (check_card == 'check') {
            console.log('this card belongs to someone already');
            return callback(body.data.attributes.username);
          } else {
            latest.push('file://' + __dirname + '/app/user.html');
            mainWindow.loadURL(latest[0]);
        
            mainWindow.webContents.once('did-finish-load', () => {
              mainWindow.webContents.send('load-user-info-2', body.data);
              mainWindow.webContents.send('load-events', e);
            });
            return true;

          }
        } else {
          if (response.statusCode == 401) {
            if (check_card == 'check') {
              console.log('good news, all is safe');
              return callback(null);
            } else {
              latest.push('file://' + __dirname + '/app/card_not_found.html');
              mainWindow.loadURL(latest[0]);
              return setTimeout(start_cardreader, 6000);
            }
          } else {
            console.log("Got an error: ", error, ", status code: ", response.statusCode);
            return false;
          }
        }   

      });
    });
    
}





app.on('ready', function() {
    mainWindow = new BrowserWindow({
        frame: false,
        kiosk: true,
        fullscreen: true,
        resizable: false,
        
    });
    //  App startup here
    cardreader =  start_cardreader('initial');





    latest.push('file://' + __dirname + '/app/index.html');
    setInterval(is_api_online, 5000);
    // setInterval(splash_screen, 30000);
    mainWindow.loadURL(latest[0]);
});

ipcMain.on('search-for-card', (event, arg)=> {
  kill_errant_rubies();
  var url = "http://" + config.api + ":" + config.port + "/nfcs/unattached_users";
  request.get({url: url, 
    json: true,
    qs: {q: arg },
    headers: {"X-Hardware-Name": config.name, "X-Hardware-Token": config.token}},
    function (error, response, body) {
      if (!error && response.statusCode === 200) {
        if (body.data.length == 0) {
          link_new_card_screen('Sorry, no matches were found. Please try another search,');
        } else {
          latest = []
          latest.push('file://' + __dirname + '/app/choose_card.html');
          mainWindow.loadURL(latest[0]);
          mainWindow.webContents.once('did-finish-load', () => {
            mainWindow.webContents.send('load-matches', body.data);
          });
        }
      }
  });
});

function safe_to_write(callback) {
  return start_cardreader('check_card', (checked) => {

    return callback(checked);
  });
}

function print_paper_ticket(code, event) {
  // make this work later, for now just go shell
  let printer = spawn("./write_guest_ticket.sh",  [code, event]);
  var out = fs.createWriteStream("/dev/ttyUSB0");
  printer.stdout.on('data', function (chunk) {
    out.write(chunk);
  });
  // setTimeout(function() {
  //         console.log("Closing file...");
  //         fs.close(out, function(err) {
  //             console.log("File has been closed", err);
  //             // At this point, Node will just hang
  //         });
  //     }, 5000);
      
      
  // serialPort.on('open',function() {
  //     var printer = new Printer(serialPort);
  //     printer.on('ready', function() {
  //         printer
  //           .bold(false)
  //           .inverse(true)
  //           .printLine('Welcome to Temporary!')
  //           .inverse(false)
  //           .printLine('You have attended:')
  //           .printLine(event)
  //           .printLine('on')
  //           .printLine(new Date().toLocaleString())
  //           .printLine('')
  //           .printLine('Your entry code is:')
  //           .bold(true)
  //           .printLine(code)
  //           .bold(false)
  //           .printLine('')
  //           .printLine('Redeem this guest ticket at:')
  //           .bold(true)
  //           .printLine('www.temporary.fi')
  //           .bold(false)
  //           .horizontalLine(10)
  //           .print(function() {
  //             console.log('done');
  //           });
  //         });
  //    printer.on('error', function(err) {
  //      console.log('Error: ', err.message);
  //    });
  // });
}

ipcMain.on('reprint', (event, data) => {
  print_paper_ticket(data.code, data.event_name);
});

ipcMain.on('print-guest-ticket', (event, data) =>  {
  latest = []
  latest.push('file://' + __dirname + '/app/printing_ticket.html');
  mainWindow.loadURL(latest[0]);
  let url = "http://" + config.api + ":" + config.port + "/instances/" + data.event + "/onetimer";
  // console.log('getting url ' + url);
  request.get({url: url, 
    json: true,
    headers: {"X-Hardware-Name": config.name, "X-Hardware-Token": config.token}},
    function(error, response, body) {
      if (!error && response.statusCode === 200) {
        print_paper_ticket(body.data.attributes.code, data.event_name);
        
        mainWindow.webContents.once('did-finish-load', () => {
          mainWindow.webContents.send('tried-to-print', {code: body.data.attributes.code, event_name: data.event_name});
        });
      } else {

        mainWindow.webContents.send('send-errors', {code: response.statusCode, error_message: body.error.message} );

      } 
    });  
});

ipcMain.on('open-guest-ticket-screen', () => {
  latest = []
  latest.push('file://' + __dirname + '/app/guest_ticket.html');
  mainWindow.loadURL(latest[0]);
  let events = events_today((e) => {
    mainWindow.webContents.once('did-finish-load', () => {
      mainWindow.webContents.send('load-events', e);
    });
  });
});

ipcMain.on('ready-to-write', (event, id) =>  {
  kill_errant_rubies();
  let url = "http://" + config.api + ":" + config.port + "/users/" + id + "/link_to_nfc";
  console.log('spawning ruby to write');
  
 // no no no - check if card exists BEFORE writing

  safe_to_write((check_me) => {
    if (check_me == null) {
      let cardwriter = spawn(config.ruby, [ config.write_tag]);
      cardwriter.stdout.on('data', function(data) {

        var res = data.toString().replace(/[\r\n]/g, "").split("---");
        let uid = res[0];
        let security_code = res[1];
        console.log("uid is " + uid + ", security key is " + security_code);
        request.post({url: url,
          form: {tag_address: uid, securekey: security_code },
          headers: {"X-Hardware-Name": config.name, "X-Hardware-Token": config.token}},
          function (error, response, body) {

            if (!error && response.statusCode === 200) {

              latest = []
              latest.push('file://' + __dirname + '/app/user.html');
              mainWindow.loadURL(latest[0]);
              mainWindow.webContents.once('did-finish-load', () => {
                message = 'Successfully created card #' + uid;
                
                
                mainWindow.webContents.send('present-flash', message);
                return query_user(uid, security_code);
           
              });
            } else if (response.statusCode == 422) {
              latest = []
              latest.push('file://' + __dirname + '/app/index.html');
              mainWindow.loadURL(latest[0]);
              mainWindow.webContents.once('did-finish-load', () => {
                message = JSON.parse(body).error.message
                mainWindow.webContents.send('present-flash', message);
                message = null;
              });
          } else {
            console.log('error code is ' + response.statusCode);
          }
          });
      });
      cardwriter.stderr.on('data', function(data) {
          console.log('stderr: ' + data);
          //Here is where the error output goes
      });
      cardwriter.on('close', function(code) {
          console.log('closing code: ' + code);
          //Here you can get the exit code of the script
      });
      cardwriter.on('error', function(err) {
        console.log('Oh noez, teh errurz: ' + err);
      });
    } else {

      latest = []
      latest.push('file://' + __dirname + '/app/index.html');
      mainWindow.loadURL(latest[0]);
      mainWindow.webContents.once('did-finish-load', () => {
        mainWindow.webContents.send('present-flash', 'This card already belongs to ' + check_me);
      });
    }
  });
});

ipcMain.on('send-to-blockchain', (event, data) => {
  kill_errant_rubies();
  let url = "http://" + config.api + ":" + config.port + "/users/" + data.name + "/instances/" + data.event + "/user_attend";
  // console.log('getting url ' + url);
  request.get({url: url, 
    json: true,
    headers: {"X-Hardware-Name": config.name, "X-Hardware-Token": config.token}},
    function(error, response, body) {
      if (!error && response.statusCode === 200) {

        let image_url = body.data.attributes.avatar.avatar.small.url;
        if (image_url == '/assets/transparent.gif') {
          image_url = 'https://temporary.fi/icons/user_missing.png';
        }
        // console.log('what have we got to play with: ' + JSON.stringify(body));
        // mainWindow.webContents.once('did-finish-load', () => {
          mainWindow.webContents.send('successful-checkin', {name: body.data.attributes.name, image_url: image_url, id: body.data.id, latest_balance: body.data.attributes['latest-balance'], last_attended: body.data.attributes['last-attended'].title, events_attended: body.data.attributes['events-attended']} );
        cardreader = setTimeout(start_cardreader, 5000);
      } else {

        mainWindow.webContents.send('send-errors', {code: response.statusCode, error_message: body.error.message} );
        cardreader = setTimeout(start_cardreader, 5000);
      } 
    });
});

ipcMain.on('check-in', (event, data) => {

  kill_errant_rubies();
  latest = []
  latest.push('file://' + __dirname + '/app/checking_in.html');

  mainWindow.loadURL(latest[0]);
  mainWindow.webContents.once('did-finish-load', () => {
    mainWindow.webContents.send('load-checkin-info', {name: data.user_name, id: data.user_id, event: data.event} );
  });

});


ipcMain.on('write-to-id', (event, id) => {
  latest = []
  latest.push('file://' + __dirname + '/app/writing_new_card.html');
  mainWindow.loadURL(latest[0]);
  let name = '';
  let image_url = '';
  var url = "http://" + config.api + ":" + config.port + "/users/" + id + ".json";
  request.get({url: url, 
    json: true,
    headers: {"X-Hardware-Name": config.name, "X-Hardware-Token": config.token}},
    function(error, response, body) {
      if (!error && response.statusCode === 200) {
        name = body.username;
        console.log('name is ' + name);
        image_url = body.avatar.avatar.small.url;
        if (image_url == '/assets/transparent.gif') {
          image_url = 'https://temporary.fi/icons/user_missing.png';
        }
        mainWindow.webContents.on('did-finish-load', () => {

          mainWindow.webContents.send('load-user-info', {name: name, image_url: image_url, id: id} );
          
        });
      } 
    });
  
  

});

ipcMain.on('main-screen', function() {
  kill_errant_rubies();
  if (cardreader) {
       clearTimeout(cardreader);
       cardreader = 0;
   }
  
  cardreader = start_cardreader();
  latest = []
  latest.push('file://' + __dirname + '/app/index.html');
  mainWindow.loadURL(latest[0]);
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.send('reader-status', JSON.stringify(cardreader));
  });
});


function link_new_card_screen(message) {
  kill_errant_rubies();
  if (cardreader) {
       clearTimeout(cardreader);
       cardreader = 0;
   }

  latest = []
  latest.push('file://' + __dirname + '/app/link_new_card.html');
  mainWindow.loadURL(latest[0]);
  if (typeof message  !== 'undefined') {
    mainWindow.webContents.once('did-finish-load', () => {
        kill_errant_rubies();
      mainWindow.webContents.send('present-flash', message);
      message = null;
    });
  } else {

  }
  
}


ipcMain.on('link-new-card', function() {
  return link_new_card_screen() ;
});


ipcMain.on('open-card-services', function erase_shit(){ 
  kill_errant_rubies();
  if (cardreader) {
    clearTimeout(cardreader);
    cardreader = 0;
  }


  latest = []
  latest.push('file://' + __dirname + '/app/erase_card.html');
  mainWindow.loadURL(latest[0]);
  let carderaser = spawn(config.ruby, [ config.erase_tag]);
  carderaser.stdout.on('data', function(data) {

    var res = data.toString().replace(/[\r\n]/g, "").split("---");
    let uid = res[0];
    let security_code = res[1];
    let url = "http://" + config.api + ":" + config.port + "/nfcs/" + uid + "/erase_tag"
    console.log("uid is " + uid + ", security key is " + security_code);
    request.get({url: url, 
      form: {tag_address: uid, securekey: security_code },
      headers: {"X-Hardware-Name": config.name, "X-Hardware-Token": config.token}},
      function (error, response, body) {
        latest = []
        latest.push('file://' + __dirname + '/app/index.html');
        mainWindow.loadURL(latest[0]);
        if (!error && response.statusCode === 200) {
          mainWindow.webContents.once('did-finish-load', () => {
            message = 'Card ' + uid + ' has been successfully erased.';
            mainWindow.webContents.send('present-flash', message);     
            message = null;
          });
        } else if (response.statusCode === 401) {
          mainWindow.webContents.once('did-finish-load', () => {
            message = 'This card was already blank, or at least not in our database.';
            mainWindow.webContents.send('present-flash', message);     
            message = null;
            
          });
        }
        setTimeout(start_cardreader, 2500);
      });
  });
  carderaser.stderr.on('data', function(data) {
    console.log('stderr from erase: ' + data);
    if (/No compatible NFC readers found/.test(data.toString())) {
      kill_errant_rubies();
      setTimeout(erase_shit, 1500);
    }
  });
  carderaser.on('close', function(code) {
      console.log('closing code: ' + code);
      //Here you can get the exit code of the script
  });
  carderaser.on('error', function(err) {
    console.log('Oh noez, teh errurz: ' + err);
  });
  
  
});


ipcMain.on('close-main-window', function () {

  kill_errant_rubies();
  app.quit();
  kill_errant_rubies();
});


//
// app.on('window-all-closed', function () {
//   // device.stop();
//
//   cardreader.stdin.pause();
//   cardreader.kill();
//   app.quit();
// });

