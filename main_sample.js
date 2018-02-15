'use strict';
let util = require('util');

var electron = require('electron');
// var app = electron.app;
// var BrowserWindow = electron.BrowserWindow;
const {app, BrowserWindow} = require('electron');
var mainWindow = null;
var request = require("request");
var fs = require('fs');
var weblock = require('lockfile');
var globalShortcut = electron.globalShortcut;
var yaml_config = require('node-yaml-config');
var config = yaml_config.load('./config/config.yml');

var Promise = require("bluebird");
var ipcMain = electron.ipcMain;
const spawn = require('child_process').spawn;
let message = '';
const screensaver = './app/img/screensaver/';
let log_file = fs.createWriteStream(__dirname + '/debug.log', {flags : 'w'});
let log_stdout = process.stdout;

const Freefare = require('freefare/index');
let freefare = new Freefare();

var biathlon = require('./biathlon');
const card_services = require('./card_services')

var latest = require('./latest.js');
let reader_status = false;

var global_abort_flag = false;

// initialise device as soon as app starts
let global_device = go();


async function go() {
  let devices = await freefare.listDevices();
	console.log("cardreader is " + devices[0].name)l
  return devices[0];
}
require('electron-context-menu')({
	prepend: (params, browserWindow) => [{
		label: 'Rainbow',
		// Only show it when right-clicking images
		visible: params.mediaType === 'image'
	}]
});

process.on('unhandledRejection', (reason, p) => {
  console.log('Unhandled Rejection at: Promise', p, 'reason:', reason);
  // application specific logging, throwing an error, or other logic here
});

// var cardreader = async function() {
async function cardreader() {

	if (!global_device) {
		let devices = await freefare.listDevices();
		//  set global device
		console.log(devices[0].name);
		global_device = devices[0];
	}
  return global_device;
	// let device = await cardreader();
	// console.log('cardreader is ' + device.name);
}

async function gos(d) {

		let device = await cardreader();
	  console.log('cardreader iz ' + device.name);
		let opened = await device.open();



	if (device) {
		console.log('device is defined');
		poll_loop(device);
	}
}

async function poll_loop(device) {
	var a;
	while (!a && global_abort_flag == false) {
	  a = await check_for_card(device);

	}
	var res = a.toString().replace(/[\r\n]/g, "").split("---");
	let uid = res[0];
	let security_code = res[1];
	console.log('uid is ' + a.tag_id + ' and security code is ' + a.security_code);
	query_user(a.tag_id, a.security_code, '', (checked) => {
		return checked;
	});
}

const poll = async (reader, delay) => {
  return new Promise((rr, reg) => {
    var res = new Promise((resolve, reject) => {
      let read = check_for_card(reader);
      if (!read) reject(read);
       else resolve(read);
     }).then((tag) =>  {

       if (tag) {
         console.log('tag! is ' + tag);

         rr(tag);
       } else {
         console.log('tag is undefined, trying again')
         reg();
       }
     }).catch(function() {
          console.log('no dice, trying again');

    });
  }).catch(function() {

  });;
};

async function apoll(reader, fn, delay) {
  var tag;
  async function scan() {
    let val = await check_for_card(reader);
    tag = val;
    if ( fn(val)) {
      reader_status = false;
      return tag;
    }
    else {

      if (delay) {

        setTimeout(scan, delay);
      } else {
        await scan();
      }
    }
  }
  let t = await scan();

  // return t;
};



async function read_card(device) {
  console.log('cardreader is ' + device.name);
  let opened = await device.open();

  // let results = await poll(device, async function(val) {
  //   // console.log('val is ' + val);
  //   if (val) {
  //     console.log('sgsd is ' + val.tag_id);
  //
  //     return val;
  //   }
  // }, 200);

  let results = await poll(device, 400);

};

async function start_reader() {
  let device = await cardreader();
  let results = new Promise((resolve, reject) => {
    let s = read_card(device);
    if (!s) { reject(s); }
    else { resolve(s) };

  }).then((iteration) => {
    if (iteration) {
      console.log('iteration is ' + iteration);
    } else {
      setTimeout(function() { poll(device, 500) }, 5000);
    }
  }).catch((err) => {
    console.log('rejected');
  });
  if (results) {
    console.log('!!tag is ' + results.tag_id);
    return query_user(results.tag_id, results.security_code, 'check_card', (checked) => {
			return callback(checked);
		});
  } else {
    console.log('fuck')
  }
}

async function write_to_card(reader, data) {

}
async function check_for_card(reader) {
  var the_tag = {};
  var tag_id = '';
  var tag_security = '';
  var tagreturn = {};
  let tags = await reader.listTags();
  if (tags[0]) {
    let opened = await tags[0].open();
    the_tag.page0 = await tags[0].read(0);
    the_tag.page1 = await tags[0].read(1);
    the_tag.page2 = await tags[0].read(2);
    the_tag.page3 = await tags[0].read(3);
    the_tag.page4 = await tags[0].read(4);
    tag_id = the_tag.page0.toString('hex') + the_tag.page1.toString('hex') + the_tag.page2.toString('hex').replace(/0000$/, '');
    tag_security =  the_tag.page4.toString('hex');
    console.log('tag id: ' + tag_id);
    console.log('tag security: ' + tag_security);
    tagreturn.tag_id = tag_id;
    tagreturn.security_code = tag_security;
    console.log('returning ' + tagreturn.tag_id);
    return tagreturn;
  }
}

async function stop_polling() {
	console.log('trying to stop polling on ' + JSON.stringify(global_device));
	global_abort_flag = true;

}



go(global_device);
// start_reader();

// cardreader.then((device) => {
//       console.log('cardreader is ' + device.name);
//       return device;
//     }).then((device) => {
//       device.open()
//       .then(() => {
//
//         poll(device, function(val) {
//           // console.log('val is ' + val);
//           if (val != 0) {
//             return val;
//           }
//         }, 200).then(function(results) {
//           if (results) {
//             console.log('tag is ' + results.tag_id);
//             return query_user(results.tag_id, results.security_code);
//
//           } else {
//             console.log('fuck')
//           }
//         }, function(err) {
//           console.log('error here ' + err);
//         });
//       });
//     });


ipcMain.on('check-in', (event, data) => {
  latest = []
  latest.push('file://' + __dirname + '/app/checking_in.html');

  mainWindow.loadURL(latest[0]);
  mainWindow.webContents.once('did-finish-load', () => {
    mainWindow.webContents.send('load-checkin-info', {name: data.user_name, id: data.user_id, event: data.event} );
  });

});





ipcMain.on('query-reader-status', (event, arg) => {
  event.sender.send('reader-reply', get_reader_status());
});

function get_reader_status() {
  return reader_status;
}

function splash_screen() {
  latest.thearray = [];
  mainWindow.loadURL('file://' + __dirname + '/app/splash.html');
  let screensaver_files = [];
  fs.readdir(screensaver, (err, files) => {
    files.forEach(file => {
      screensaver_files.push("img/screensaver/" + file);

    });
    mainWindow.webContents.once('did-finish-load', () => {
      mainWindow.webContents.send('send-screensaver-files', screensaver_files);
    });
  })


}




// function poll(reader, fn, delay) {
//   return new Promise(function(resolve, reject) {
//
//     var tag;
//     function scan() {
//       check_for_card(reader).then(function(val) {
//         tag = val;
//
//         if (fn(val)) {
//           reader_status = false;
//           resolve(tag);
//
//         } else {
//
//           if (delay) {
//
//             setTimeout(scan, delay);
//           } else {
//
//             scan();
//           }
//         }
//       }, Promise.resolve());
//     }
//
//     scan();
//   });
// }
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
              return; // setTimeout(start_cardreader, 6000);
            }
          } else {
            console.log("Got an error: ", error, ", status code: ", response.statusCode);
            return false;
          }
        }

      });
    });

}

ipcMain.on('search-for-card', (event, arg)=> {
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
          image_url = config.missing_icon;
        }
        mainWindow.webContents.on('did-finish-load', () => {
          mainWindow.webContents.send('load-user-info', {name: name, image_url: image_url, id: id} );
        });
      }
    });
});
// function check_for_card(reader) {
//   // console.log('reader is ' + reader.name);
//   return new Promise(function(resolve) {
//     // console.log('checking for card')
//     reader_status = true;
//     reader.listTags()
//     .then((tags) => {
//       // console.log('Tag list (' + reader.name + ') :');
//       var the_tag = {};
//       var tag_id = '';
//       var tag_security = '';
//       var tagreturn = {};
//       // if (tags[0]) {
//      	  console.log(tags[0].getFriendlyName());
//         console.log(tags[0].getUID());
//         tags[0].open()
//         .then(() => {
//           tags[0].read(0).then((page0) => {
//             the_tag.page0 = page0;
//             return tags[0].read(1);
//           }).then((page1) => {
//             the_tag.page1 = page1;
//             return tags[0].read(2);
//           }).then((page2) => {
//             the_tag.page2 = page2;
//             return tags[0].read(3);
//           }).then((page3) => {
//             the_tag.page3 = page3;
//             return tags[0].read(4);
//           }).then((page4) => {
//             the_tag.page4 = page4;
//           }).then(() => {
//             tag_id = the_tag.page0.toString('hex') + the_tag.page1.toString('hex') + the_tag.page2.toString('hex').replace(/0000$/, '');
//             tag_security =  the_tag.page4.toString('hex');
//             console.log('tag id: ' + tag_id);
//             console.log('tag security: ' + tag_security);
//             tagreturn.tag_id = tag_id;
//             tagreturn.security_code = tag_security;
//             resolve(tagreturn);
//             // resolve(the_tag);
//           })
//         })
//       })
//       .catch(error => {
//         resolve(0);
//       });
//   });
// }






app.on('ready', function() {
    mainWindow = new BrowserWindow({
        frame: false,
        kiosk: false,
        fullscreen: false,
        resizable: false,

    });
    //  App startup here



    latest.ppush('file://' + __dirname + '/app/index.html');
    //
    setInterval(function() { biathlon.is_api_online(mainWindow) }, 5000);
    setInterval(splash_screen, 30000);
    mainWindow.loadURL(latest.thearray[0]);

});

ipcMain.on('link-new-card', function() {
	stop_polling();
  return card_services.link_new_card_screen(mainWindow);
});



ipcMain.on('main-screen', function() {


  latest = []
  latest.push('file://' + __dirname + '/app/index.html');
  mainWindow.loadURL(latest[0]);
  mainWindow.webContents.once('did-finish-load', () => {
    mainWindow.webContents.send('reader-status', JSON.stringify(cardreader));
  });
});


ipcMain.on('close-main-window', function () {

  app.quit();

});


ipcMain.on('activate-screensaver', () => {

  splash_screen();
});

ipcMain.on('ready-to-write', (event, id) =>  {
  let url = "http://" + config.api + ":" + config.port + "/users/" + id + "/link_to_nfc";

 // no no no - check if card exists BEFORE writing

  safe_to_write((check_me) => {
    if (check_me == null) {
      let cardwriter = write_card
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

ipcMain.on('send-to-blockchain',  function (event, data)  {
  let url = "http://" + config.api + ":" + config.port + "/users/" + data.name + "/instances/" + data.event + "/user_attend";
  // console.log('getting url ' + url);
  request.get({url: url,
    json: true,
    headers: {"X-Hardware-Name": config.name, "X-Hardware-Token": config.token}},
    async function(error, response, body) {
      if (!error && response.statusCode === 200) {

        let image_url = body.data.attributes.avatar.avatar.small.url;
        if (image_url == '/assets/transparent.gif') {
          image_url = config.missing_icon;
        }
        // console.log('what have we got to play with: ' + JSON.stringify(body));
        // mainWindow.webContents.once('did-finish-load', () => {
          mainWindow.webContents.send('successful-checkin', {name: body.data.attributes.name, image_url: image_url, id: body.data.id, latest_balance: body.data.attributes['latest-balance'], last_attended: body.data.attributes['last-attended'].title, events_attended: body.data.attributes['events-attended']} );

					go(global_device);
      } else {

        mainWindow.webContents.send('send-errors', {code: response.statusCode, error_message: JSON.stringify(body.error.message)} );

				go(global_device);
      }
    });
});
