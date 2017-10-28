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
require('electron-debug')({showDevTools: false});
const Freefare = require('freefare/index');
let freefare = new Freefare();


var biathlon = require('./biathlon');


var latest = require('./latest.js');
let reader_status = false;
var global_device_ready = false;
var is_polling = false;

// initialise device as soon as app starts

let device = null;
let node_address = get_node_address();

initialise_reader();

//  get Node address from API on startup.
//  Do this every time, in case node contract is upgraded/migrated.
//  Also, crash out if the API isn't contactable.
async function get_node_address() {
	var url = 'http://' + config.api + ":" + config.port + '/contract_address';
	return request.get({url: url,
		json: true,
		headers: {"X-Hardware-Name": config.name, "X-Hardware-Token": config.token}},
		(error, response, body) => {
			if (!error && response.statusCode === 200) {
				console.log('node address is ' + body.data);
				return body.data;
			} else {
				console.log('Cannot get node address - is API online? Is kiosk online?');
				process.exit(1);
			}
	});
}
async function initialise_reader() {
	let devices = await freefare.listDevices();
	await devices[0].open();
	device = devices[0];
	console.log('got ' + device.name);
	is_polling = true;
	await go();
}
async function go() {
	console.log('entering go(), is_polling is ' + is_polling);
	if (is_polling) {
		poll_loop(device);
	}
}

async function poll_loop(d) {
	var a;

	while (!a && is_polling == true) {
	  a = await check_for_card(d);
		await sleep(400);
	}

	if (a) {

		is_polling = false;
		var res = a.toString().replace(/[\r\n]/g, "").split("---");
		let uid = res[0];
		let security_code = res[1];
		console.log('uid is ' + a.tag_id + ' and security code is ' + a.security_code);
		query_user(a.tag_id, a.security_code, '', (checked) => {
			return checked;
		});
	}
}


async function safe_to_write(callback) {
	var a = false;
	is_polling = true;
	while (!a && is_polling == true) {
	  a = await check_for_card(device);
		await sleep(400);
	}
	if (a) {
		is_polling = false;
		var res = a.toString().replace(/[\r\n]/g, "").split("---");
		let uid = res[0];
		let security_code = res[1];
		console.log('uid is ' + a.tag_id + ' and security code is ' + a.security_code);
		query_user(a.tag_id, a.security_code, 'check', (checked) => {
			return callback(checked);
		});
	}
}

function sleep(ms = 0) {
  return new Promise(r => setTimeout(r, ms));
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

});

function toPaddedHexString(num, len) {
    let str = num.toString(16);
    return "0".repeat(len - str.length) + str;
}

function hexToBytes(hex) {
    for (var bytes = [], c = 0; c < hex.length; c += 2)
    bytes.push(parseInt(hex.substr(c, 2), 16));
    return bytes;
}

function bytesToHex(bytes) {
    for (var hex = [], i = 0; i < bytes.length; i++) {
        hex.push((bytes[i] >>> 4).toString(16));
        hex.push((bytes[i] & 0xF).toString(16));
    }
    return hex.join("");
}

async function old_erase_card(reader, data) {
	var keepPolling = true;
	setTimeout(function () {
    keepPolling = false;
	}, 10000);
	while(keepPolling) {
		let tags = await reader.listTags();
		if (tags[0]) {
			let tag_type = await tags[0].getType();
			if (tag_type == 'MIFARE_ULTRALIGHT') {
				var the_tag = {};
				let opened = await tags[0].open();
				the_tag.page0 = await tags[0].read(0);
				the_tag.page1 = await tags[0].read(1);
				the_tag.page2 = await tags[0].read(2);
				the_tag.page4 = await tags[0].read(4);
				let old_security = the_tag.page4.toString('hex');
				let tag_id = the_tag.page0.toString('hex') + the_tag.page1.toString('hex') + the_tag.page2.toString('hex').replace(/0000$/, '');
				let write_attempt = await tags[0].write(4, new Buffer(hexToBytes('00000000')));
				console.log('you we got an ultralight here: ' + tag_id + "---" + old_security);
				return tag_id + "---" + old_security;
			}
		} else {
			console.log('no tag present, try again?');
			await sleep(300);
		}
	}
}

async function old_write_card(reader, data) {
	//  figure out which kind of tag it is
	let tags = await reader.listTags();
	if (tags[0]) {
		let tag_type = await tags[0].getType();
		if (tag_type == 'MIFARE_ULTRALIGHT') {

			var the_tag = {};
			let opened = await tags[0].open();
			the_tag.page0 = await tags[0].read(0);
			the_tag.page1 = await tags[0].read(1);
			the_tag.page2 = await tags[0].read(2);
			// generate security code
			let security = Array.from({length: 4}, () => toPaddedHexString(Math.floor(Math.random() * 255 + 1), 2)).join('');
			let tag_id = the_tag.page0.toString('hex') + the_tag.page1.toString('hex') + the_tag.page2.toString('hex').replace(/0000$/, '');
			console.log('would try to write now: ' + tag_id + "---" + security);
			console.log('ultralight found, attempting to write sec code');
			let write_attempt = await tags[0].write(4, new Buffer(hexToBytes(security)));
			return tag_id + "---" + security;
		} else if (tag_type == 'MIFARE_CLASSIC_1K' || tag_type ==  'MIFARE_CLASSIC_1K') {
			console.log('classic');
		}
	}
	return Array.from({length:16}, () => Math.floor(Math.random() * 255 + 1));
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
	console.log('trying to stop polling on ' + JSON.stringify(device.name));
	is_polling = false;

}




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
  return is_polling;

}

function splash_screen() {
  latest.thearray = [];
  mainWindow.loadURL('file://' + __dirname + '/app/splash.html');
  let screensaver_files = [];
  fs.readdir(screensaver, (err, files) => {
    files.forEach(file => {
      screensaver_files.push("img/screensaver/" + file);

    });
    mainWindow.webContents.on('did-finish-load', () => {
      mainWindow.webContents.send('send-screensaver-files', screensaver_files);
    });
  })


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
							is_polling =  false;
              return;
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
    async function (error, response, body) {
      if (!error && response.statusCode === 200) {
        if (body.data.length == 0) {
          link_new_card_screen('Sorry, no matches were found. Please try another search,');
        } else {
          latest = []
          latest.push('file://' + __dirname + '/app/choose_card.html');
          mainWindow.loadURL(latest[0]);
          mainWindow.webContents.once('did-finish-load', () => {
						console.log('device status is ' + JSON.stringify(device));
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
    // setInterval(splash_screen, 30000);
    mainWindow.loadURL(latest.thearray[0]);

});

ipcMain.on('link-new-card', function() {
	stop_polling();
  return link_new_card_screen(mainWindow);
});


ipcMain.on('main-screen', async function() {

  latest = []
  latest.push('file://' + __dirname + '/app/index.html');
  await mainWindow.loadURL(latest[0]);
  mainWindow.webContents.once('did-finish-load', () => {
  	mainWindow.webContents.send('reader-status', JSON.stringify(device));

		is_polling = true;
		go();
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

  safe_to_write(async (check_me) => {
    if (check_me == null) {

      let cardwriter = await old_write_card(device);
			var res = cardwriter.toString().replace(/[\r\n]/g, "").split("---");
			let uid = res[0];
			let security_code = res[1];
			console.log("uid is " + uid + ", security key is " + security_code);
			request.post({url: url,
				form: {tag_address: uid, securekey: security_code },
				headers: {"X-Hardware-Name": config.name, "X-Hardware-Token": config.token}},
				function (error, response, body) {

					if (!error && response.statusCode === 200) {

						latest = []
						latest.push('file://' + __dirname + '/app/flash_screen.html');
						mainWindow.loadURL(latest[0]);
						mainWindow.webContents.once('did-finish-load', () => {
							message = 'Successfully created card #' + uid;


							mainWindow.webContents.send('present-flash', message);
							// return query_user(uid, security_code);

						});
					} else if (response.statusCode == 422) {
						latest = []
						latest.push('file://' + __dirname + '/app/flash_screen.html');
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
					console.log('setting polling to TRUE');
					is_polling = true;
					go();
      } else {

        mainWindow.webContents.send('send-errors', {code: response.statusCode, error_message: JSON.stringify(body.error.message)} );
				console.log('setting polling to TRUE in send-to-blockchain errors');
				is_polling = true;
				go();
      }
    });
});

function link_new_card_screen(message) {

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



ipcMain.on('open-card-services', async function erase_shit(){
	await stop_polling();

  latest = []
  latest.push('file://' + __dirname + '/app/erase_card.html');
  mainWindow.loadURL(latest[0]);
	mainWindow.webContents.once('did-finish-load', async () => {
		let carderaser = await old_erase_card(device);
		console.log('carderaser is ' + JSON.stringify(carderaser));
  	if (carderaser) {
	    var res = carderaser.toString().replace(/[\r\n]/g, "").split("---");
	    let uid = res[0];
	    let security_code = res[1];
	    let url = "http://" + config.api + ":" + config.port + "/nfcs/" + uid + "/erase_tag"
	    console.log("uid is " + uid + ", security key is " + security_code);
    	request.get({url: url,
      	form: {tag_address: uid, securekey: security_code },
      	headers: {"X-Hardware-Name": config.name, "X-Hardware-Token": config.token}},
      	async function (error, response, body) {
	        latest = []
	        latest.push('file://' + __dirname + '/app/flash_screen.html');
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
      });
  	} else {
			console.log('error');
		}
	});
});
