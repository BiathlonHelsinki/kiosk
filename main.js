'use strict';
let util = require('util');

var electron = require('electron');
// var app = electron.app;
// var BrowserWindow = electron.BrowserWindow;
const {app, BrowserWindow} = require('electron');
var mainWindow = null;
var request = require("request");
var fs = require('fs');
let nfclock = require('lockfile');
var globalShortcut = electron.globalShortcut;
var yaml_config = require('node-yaml-config');
var config = yaml_config.load('./config/config.yml');
const SerialPort = require('serialport');
let serialPort
let Printer = require('thermalprinter');
var Promise = require("bluebird");
var ipcMain = electron.ipcMain;
const spawn = require('child_process').spawn;
let message = '';
const screensaver = './app/themes/' + config.theme + '/img/screensaver/';
let log_file = fs.createWriteStream(__dirname + '/debug.log', {flags : 'w'});
let log_stdout = process.stdout;
require('electron-debug')({showDevTools: false});
const Freefare = require('freefare/index');
let freefare = new Freefare();


const biathlon = require('./biathlon');


let latest = require('./latest.js');
let reader_status = false;
var global_device_ready = false;
var is_polling = false;

// initialise device as soon as app starts

let device = null;
let node_address = null;
let token_address = null;

function connect_printer() {
  try {
    serialPort = new SerialPort('/dev/thermalprinter', {
         baudrate: 9600
    });
  } catch(err) {
    console.log('serialport error: ')
  }
}

async function populate_node_address() {
	let ary = await get_node_address();
  node_address = ary[0]
  token_address = ary[1]
	return ary;
}


// unlock()
connect_printer()
populate_node_address()


//  get Node address from API on startup.
//  Do this every time, in case node contract is upgraded/migrated.
//  Also, crash out if the API isn't contactable.
function get_node_address() {
	var url = 'http://' + config.api + ":" + config.port + '/contract_address';
	var out = '';
	return new Promise(function (resolve, reject) {
		request.get({url: url,
			json: true,
			headers: {"X-Hardware-Name": config.name, "X-Hardware-Token": config.token}},
			(error, response, body) => {
				if (!error && response.statusCode === 200) {
          initialise_reader()
					resolve([body.data.contract_address, body.data.token_address]);
				} else {

          stop_polling()
					console.log('Cannot get node address - is API online? Is kiosk online?');

					mainWindow.loadURL('file://' + __dirname + '/app/themes/' + config.theme + '/kiosk_offline.html');

          mainWindow.webContents.once('did-finish-load', () => {

          });
          return true;
					reject(error);
				}
		});
	});


}
async function initialise_reader() {
  try {
  	let devices = await freefare.listDevices();
  	await devices[0].open();
  	device = devices[0];
  	console.log('got ' + device.name);
      console.log('node address is ' + JSON.stringify(node_address))
    console.log('token address is ' + JSON.stringify(token_address))
  	is_polling = 1;
  	await go();
  } catch (e) {
    console.log('got an error: ' + util.inspect(e))
    initialise_reader()
  }
}
async function go() {

	if (is_polling > 0) {
    // console.log('entering poll_loop(), is_polling is ' + is_polling);
    poll_loop(device);

	} else {
    // console.log('not polling, is_polling is ' + is_polling);
  }
}

async function poll_loop(d) {
	var a;

	while (!a && is_polling > 0) {
        is_polling += 1
        // console.log('is_polling is ' + is_polling)
        a = await check_for_card(d);
    		await sleep(200);

  }

	if (a) {
    latest.thearray = [];
    mainWindow.loadURL('file://' + __dirname + '/app/themes/' + config.theme + '/card_read.html');

		is_polling = 0;

		if (a.toString().length == 15) {
			// old card, so

			var res = a.toString().replace(/[\r\n]/g, "").split("---");
			let uid = res[0];
			let security_code = res[1];
			if (!a.user_address) {
				query_user(a.tag_id, a.security_code, '', (checked) => {
					return checked;
				});
			} else {
				new_query_user(a, (checked) => {
					return checked;
				});
			}
		}
		else {
			console.log('new card?');
		}

	}
}


async function check_for_card(reader) {
  var the_tag = {};
  var tag_id = '';
  var tag_security = '';
  var tagreturn = {};
  // console.log('looking for card...')
  let tags = await reader.listTags();
  if (tags[0]) {
    let opened = await tags[0].open();
    for (let i = 0; i<16; i++) {
      try {
        the_tag["page" + i] = await tags[0].read(i);
      } catch (error) {
        console.log('error reading card, go back to beginning');
      }
    }
    tag_id = the_tag.page0.toString('hex') + the_tag.page1.toString('hex') + the_tag.page2.toString('hex').replace(/0000$/, '');
    tag_security = the_tag.page4.toString('hex');
    console.log('tag id: ' + tag_id);
    console.log('tag security: ' + tag_security);
    tagreturn.tag_id = tag_id;
    tagreturn.security_code = tag_security;
    if (the_tag.page10 != undefined) {
      if (the_tag.page10.toString('hex') == '00000000') {
        // does not have 0x addresses written to card, so either blank or old, so try the old query first
        console.log('returning ' + tagreturn.tag_id + ' in old format, should get upgraded');

      } else {    // here there is an ethereum address written to the card, so...
        tagreturn.node_address = the_tag.page5.toString('hex') + the_tag.page6.toString('hex') + the_tag.page7.toString('hex') + the_tag.page8.toString('hex') + the_tag.page9.toString('hex');
        console.log('node address: 0x' + tagreturn.node_address);
        tagreturn.user_address = the_tag.page10.toString('hex') + the_tag.page11.toString('hex') + the_tag.page12.toString('hex') + the_tag.page13.toString('hex') + the_tag.page14.toString('hex');
        console.log('user address: 0x' + tagreturn.user_address)

      }
    }
    return tagreturn;
  }
}


async function unlock() {
  console.log('removing lockfile if it exists')
  await nfclock.unlock('nfclock.lock')
}


function byteLength(str) {
  // returns the byte length of an utf8 string
  var s = str.length;
  for (var i=str.length-1; i>=0; i--) {
    var code = str.charCodeAt(i);
    if (code > 0x7f && code <= 0x7ff) s++;
    else if (code > 0x7ff && code <= 0xffff) s+=2;
    if (code >= 0xDC00 && code <= 0xDFFF) i--; //trail surrogate
  }
  return s;
}


async function safe_to_write(callback) {
	var a = false;
	is_polling = true;
	while (!a && is_polling == true) {
    nfclock.lock('cardreader.lock')
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
	}, 10000)
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
				the_tag.page3 = await tags[0].read(3);
				the_tag.page4 = await tags[0].read(4);

				let old_security = the_tag.page4.toString('hex');
				let tag_id = the_tag.page0.toString('hex') + the_tag.page1.toString('hex') + the_tag.page2.toString('hex').replace(/0000$/, '');
				for(var i = 4; i < 16; i++) {
					let write_attempt = await tags[0].write(i, new Buffer(hexToBytes('00000000')));
				}


				return tag_id + "---" + old_security;
			}
		} else {
			console.log('no tag present, try again?');
			await sleep(300);
		}
	}
}

async function write_card(reader, user_account, security_code) {

    let tags = await reader.listTags();

	// if (tags[0]) {
    let tag_type = await tags[0].getType();
    // if (tag_type == 'MIFARE_ULTRALIGHT') {

      var the_tag = [];
      let opened = await tags[0].open();
      return new Promise(async(resolve, reject) => {
        request.get({
          url: "http://" + config.api + ":" + config.port + "/users/" + user_account.id + "/get_eth_address",
          json: true,
          headers: {"X-Hardware-Name": config.name, "X-Hardware-Token": config.token}
          }, async(error, response, body) => {
            console.log('body of ' + "http://" + config.api + ":" + config.port + "/users/" + user_account.id + "/get_eth_address :" + util.inspect(body))
          if(!error && response.statusCode === 200) {
            if (security_code != 'skip') {
              let write_security = await tags[0].write(4, new Buffer(hexToBytes(security_code)))
            }
            the_tag = body.address.replace(/^0x/, '').match(/.{1,8}/g);
            for (let [index, segment] of the_tag.entries()) {
              console.log('writing ' + segment + ' of length ' + byteLength(segment) + ' to page ' + (index + 10));
              let write_attempt = await tags[0].write(index + 10, new Buffer(hexToBytes(segment)));
            }
            console.log('na is ' + node_address);
            the_tag = [];
            the_tag = node_address.replace(/^0x/, '').match(/.{1,8}/g);
            for (let [index, segment] of the_tag.entries()) {
              let write_attempt = await tags[0].write(index + 5, new Buffer(hexToBytes(segment)));
              console.log('wrote ' + segment + ' to page ' + (index + 5));
            }
            // get tag id and return it for API/db
            let tag_id = {}
            tag_id.page0 = await tags[0].read(0);
            tag_id.page1 = await tags[0].read(1);
            tag_id.page2 = await tags[0].read(2);
            resolve(tag_id.page0.toString('hex') + tag_id.page1.toString('hex') + tag_id.page2.toString('hex').replace(/0000$/, ''))

          }
          else {

            console.log('did not get eth address to write: ' + util.inspect(error))
            reject(false)
          }
        })
      })
}






ipcMain.on('check-in', (event, data) => {
  latest = []
  latest.push('file://' + __dirname + '/app/themes/' + config.theme + '/checking_in.html');

  mainWindow.loadURL(latest[0]);
  mainWindow.webContents.once('did-finish-load', () => {
    mainWindow.webContents.send('load-checkin-info', {name: data.user_name, id: data.user_id, event: data.event} );
  });

});

ipcMain.on('back-from-screensaver', () => {
  console.log('should start polling here')
  is_polling = true;
  go();
})

ipcMain.on('query-reader-status', (event, arg) => {
	event.sender.send('reader-reply', get_reader_status());
});

function get_reader_status() {
  return is_polling;

}

function splash_screen() {
  latest.thearray = [];
  mainWindow.loadURL('file://' + __dirname + '/app/themes/' + config.theme + '/splash.html');
  // let screensaver_files = [];
  // fs.readdir(screensaver, (err, files) => {
  //   files.forEach(file => {
  //     screensaver_files.push("img/screensaver/" + file);

  //   });
    // mainWindow.webContents.on('did-finish-load', () => {
    //   mainWindow.webContents.send('send-screensaver', screensaver_files);
    // });
  // })


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

function new_query_user(tag, callback) {
	latest = [];

	var url = 'http://' + config.api + ":" + config.port + '/nfcs/verify_tag';
	let events = events_today((e) => {
		request.post({url: url,
			json: true,
			form: {securekey: tag.security_code, tag_address: tag.tag_id, user_address: tag.user_address, node_address: tag.node_address},
			headers: {"X-Hardware-Name": config.name, "X-Hardware-Token": config.token}},
			function (error, response, body) {
        if (!error && response.statusCode === 200) {
					latest.push('file://' + __dirname + '/app/themes/' + config.theme + '/user.html');
					mainWindow.loadURL(latest[0]);

					mainWindow.webContents.once('did-finish-load', () => {
						mainWindow.webContents.send('load-user-info-2', body.data);
						mainWindow.webContents.send('load-events', e);
					});
					return true;
				}
				else {

					latest.push('file://' + __dirname + '/app/themes/' + config.theme + '/card_not_found.html');
					mainWindow.loadURL(latest[0]);
					is_polling =  false;
					return;
				}

		});

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
          }

					else {
            latest.push('file://' + __dirname + '/app/themes/' + config.theme + '/upgrading_card.html');
            mainWindow.loadURL(latest[0]);

            mainWindow.webContents.once('did-finish-load', () => {
              mainWindow.webContents.send('load-user-info-2', body);
              // mainWindow.webContents.send('load-events', e);
            });
            return true;

          }
        } else {
          if (response.statusCode == 401) {
            if (check_card == 'check') {
              console.log('good news, all is safe');
              return callback(null);
            } else {
              latest.push('file://' + __dirname + '/app/themes/' + config.theme + '/card_not_found.html');
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

        if (body.data.length < 1) {
          mainWindow.loadURL(latest[0]);
          mainWindow.webContents.once('did-finish-load', () => {
            mainWindow.webContents.send('get-error', 'Sorry, no matches were found. Please try another search.')
          })
        } else {
          latest = []
          latest.push('file://' + __dirname + '/app/themes/' + config.theme + '/choose_card.html');
          mainWindow.loadURL(latest[0]);
          mainWindow.webContents.once('did-finish-load', () => {
						console.log('device status is ' + JSON.stringify(device));
            mainWindow.webContents.send('load-matches', body.data);
          });
        }
      }
  });
});

ipcMain.on('write-to-id', (event, id, pin) => {

  mainWindow.loadURL(latest[0]);
  let name = '';
  let image_url = '';
  var url = "http://" + config.api + ":" + config.port + "/users/" + id + "/check_pin";
  request.post({url: url,
    json: true,
    form: {pin: pin},
    headers: {"X-Hardware-Name": config.name, "X-Hardware-Token": config.token}},
    function(error, response, body) {
      if (!error && response.statusCode === 200) {
        latest = []
        latest.push('file://' + __dirname + '/app/themes/' + config.theme + '/writing_new_card.html');
        name = body.data.attributes.username;
        console.log('name is ' + name);
        mainWindow.loadURL(latest[0]);
        image_url = body.data.attributes.avatar.avatar.small.url;
        if (image_url == '/assets/transparent.gif') {
          image_url = config.missing_icon;
        }
        mainWindow.webContents.once('did-finish-load', () => {
          mainWindow.webContents.send('load-user-info', {name: name, image_url: image_url, id: id, pin: pin} );
        });
      } else if (response.statusCode === 403) {
          console.log(body.error)
          latest = []
          latest.push('file://' + __dirname + '/app/themes/' + config.theme + '/error.html');
          mainWindow.loadURL(latest[0]);
          mainWindow.webContents.once('did-finish-load', () => {
            mainWindow.webContents.send('load-error', body.error );
            setTimeout( () =>  {
               link_new_card_screen(mainWindow)
            }, 6000)
          })
      }
    });
});

app.disableHardwareAcceleration()


app.on('ready', function() {

    mainWindow = new BrowserWindow({
      width: 1366,
      height: 768,
      frame: false,
      kiosk: false,
      fullscreen: false,
      resizable: false,

    });
    //  App startup here
    latest.ppush('file://' + __dirname + '/app/themes/' + config.theme + '/index.html');

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
  latest.push('file://' + __dirname + '/app/themes/' + config.theme + '/index.html');
  await mainWindow.loadURL(latest[0]);
  mainWindow.webContents.once('did-finish-load', () => {
  	mainWindow.webContents.send('reader-status', JSON.stringify(device));

		is_polling = 1;
		go();
  });

});


ipcMain.on('close-main-window', function () {
  app.quit();
});


ipcMain.on('activate-screensaver', () => {
  is_polling = 0
  splash_screen();
});

ipcMain.on('ready-to-upgrade', async function (event, id)  {
  let url = "http://" + config.api + ":" + config.port + "/users/" + id + "/get_eth_address";
  let user_address = await request.get({url: url,
		// form: {tag_address: uid, securekey: security_code },
		headers: {"X-Hardware-Name": config.name, "X-Hardware-Token": config.token}},
		async (error, response, body) => {
			if (!error && response.statusCode === 200) {

				let a = { }
        a['id']= id
				let write_operation = await write_card(device, a, 'skip');
				latest = []
				latest.push('file://' + __dirname + '/app/themes/' + config.theme + '/flash_screen.html');
				mainWindow.loadURL(latest[0]);
				mainWindow.webContents.once('did-finish-load', () => {
					message = 'Your card has been upgraded to the new format.'
					mainWindow.webContents.send('present-flash', message);
					message = null;
				});
			} else {
                console.log(body.error)
                latest = []
                latest.push('file://' + __dirname + '/app/themes/' + config.theme + '/error.html');
                mainWindow.loadURL(latest[0]);
                mainWindow.webContents.once('did-finish-load', () => {
                    mainWindow.webContents.send('load-error', body.error );
					setTimeout( () =>  {
						link_new_card_screen(mainWindow)
					}, 6000)
			    })
			}
		})

})



ipcMain.on('ready-to-write', async (event, id, pin) =>  {

  let write_url = "http://" + config.api + ":" + config.port + "/users/" + id + "/link_to_nfc"
  let read_url = "http://" + config.api + ":" + config.port + "/users/" + id + "/check_pin"
  request.post({url: read_url, json: true, form: {pin: pin}, headers: {"X-Hardware-Name": config.name, "X-Hardware-Token": config.token}},
      async function (error, response, body) {
      	if (!error && response.statusCode === 200) {
          // if response.body.eth_account is blank, we have to create a new one

	  	    safe_to_write(async (check_me) => {
            if (check_me == null) {
              // generate random security code
              let security_code = Array.from({length: 4}, () => toPaddedHexString(Math.floor(Math.random() * 255 + 1), 2)).join('');


              let uid = await write_card(device, body.data, security_code)

              console.log(" SHOULD NOT HAPPEN UNTIL AFTER WRITE :: this uid is "  + util.inspect(uid) + ", security key is " + security_code)


              request.post({url: write_url,
                  form: {tag_address: uid, securekey: security_code },
                  headers: {"X-Hardware-Name": config.name, "X-Hardware-Token": config.token}},
                  function (error, response, body) {

                    if (!error && response.statusCode === 200) {

                      latest = []
                      latest.push('file://' + __dirname + '/app/themes/' + config.theme + '/flash_screen.html');
                      mainWindow.loadURL(latest[0]);
                      mainWindow.webContents.once('did-finish-load', () => {
                        message = 'Successfully created card #' + uid;
                        mainWindow.webContents.send('present-flash', message);
                        // return query_user(uid, security_code);

                      });
                    } else if (response.statusCode == 422) {
                      latest = []
                      latest.push('file://' + __dirname + '/app/themes/' + config.theme + '/flash_screen.html');
                      mainWindow.loadURL(latest[0]);
                      mainWindow.webContents.once('did-finish-load', () => {
                        message = JSON.parse(body).error.message
                        mainWindow.webContents.send('present-flash', message);
                        message = null;
                      });
                    } else {
                       console.log('error code is ' + response.statusCode);
                     }
              })
			      } else {
              console.log("check me was not null")
              latest = []
              latest.push('file://' + __dirname + '/app/themes/' + config.theme + '/error.html');
              mainWindow.loadURL(latest[0]);
              mainWindow.webContents.once('did-finish-load', () => {
                mainWindow.webContents.send('load-error', body.error );
                setTimeout( () =>  {
                  link_new_card_screen(mainWindow)
               }, 6000)
              })
			      }
          })
        } else {
          latest = []
          latest.push('file://' + __dirname + '/app/themes/' + config.theme + '/error.html');
          mainWindow.loadURL(latest[0]);
          mainWindow.webContents.once('did-finish-load', () => {
            mainWindow.webContents.send('load-error', body.error );
            setTimeout( () =>  {
              link_new_card_screen(mainWindow)
            }, 6000)
          })
        }
      })
})

ipcMain.on('send-to-blockchain',  function (event, data)  {
  let url = "http://" + config.api + ":" + config.port + "/users/" + data.name + "/instances/" + data.event + "/user_attend";
  // console.log('getting url ' + url);
  request.get({url: url,
    json: true,
    headers: {"X-Hardware-Name": config.name, "X-Hardware-Token": config.token}},
    async function(error, response, body) {
      if (!error && response.statusCode === 200) {
        console.log(util.inspect(body.data))
        let image_url = body.data.attributes.avatar.avatar.small.url;
        if (image_url == '/assets/transparent.gif') {
          image_url = config.missing_icon;
        }
        // console.log('what have we got to play with: ' + JSON.stringify(body));
        // mainWindow.webContents.once('did-finish-load', () => {
          mainWindow.webContents.send('successful-checkin', {name: body.data.attributes.name, image_url: image_url, id: body.data.id, latest_balance: body.data.attributes.latest_balance, last_attended: body.data.attributes.last_attended.title, events_attended: body.data.attributes.events_attended} );
					// console.log('setting polling to 1');
					is_polling = 1;
					// go();
      } else {

        mainWindow.webContents.send('send-errors', {code: response.statusCode, error_message: JSON.stringify(body.error.message)} );
				// console.log('setting polling to 1 in send-to-blockchain errors');
				is_polling = 1;
				// go();
      }
    });
});

function link_new_card_screen(message) {

	latest = []
	latest.push('file://' + __dirname + '/app/themes/' + config.theme + '/link_new_card.html');
	mainWindow.loadURL(latest[0]);
	// if (typeof message  !== 'undefined') {
	// 	mainWindow.webContents.once('did-finish-load', () => {
  //
	// 		mainWindow.webContents.send('present-flash', message);
	// 		message = null;
	// 	});
	// } else {
  //
	// }
	console.log('exiting link_new_card_screen');
	return;
}



ipcMain.on('open-card-services', async function erase_shit(){
	await stop_polling();

  latest = []
  latest.push('file://' + __dirname + '/app/themes/' + config.theme + '/erase_card.html');
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
    	request.post({url: url,
      	form: {tag_address: uid, securekey: security_code },
      	headers: {"X-Hardware-Name": config.name, "X-Hardware-Token": config.token}},
      	async function (error, response, body) {
	        latest = []
	        latest.push('file://' + __dirname + '/app/themes/' + config.theme + '/flash_screen.html');
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

function print_paper_ticket(code, event) {
  // make this work later, for now just go shell
  let printer = spawn("./write_guest_ticket.sh",  [code, event]);
  var out = fs.createWriteStream("/dev/thermalprinter");
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


  serialPort.on('open',function() {
      var printer = new Printer(serialPort);
      printer.on('ready', function() {
          printer
            .bold(false)
            .inverse(true)
            .printLine('Welcome to Kuusi Palaa!')
            .inverse(false)
            .printLine('You have attended:')
            .printLine(event)
            .printLine('on')
            .printLine(new Date().toLocaleString())
            .printLine('')
            .printLine('Your entry code is:')
            .bold(true)
            .printLine(code)
            .bold(false)
            .printLine('')
            .printLine('Redeem this guest ticket at:')
            .bold(true)
            .printLine('www.kuusipalaa.fi')
            .bold(false)
            .horizontalLine(10)
            .print(function() {
              console.log('done');
            });
          });
     printer.on('error', function(err) {
       console.log('Error: ', err.message);
     });
  });
}

ipcMain.on('reprint', (event, data) => {
  print_paper_ticket(data.code, data.event_name);
});

ipcMain.on('print-guest-ticket', (event, data) =>  {
  latest = []
  latest.push('file://' + __dirname + '/app/themes/' + config.theme + '/printing_ticket.html');
  mainWindow.loadURL(latest[0]);
  let url = "http://" + config.api + ":" + config.port + "/instances/" + data.event + "/onetimer";
  // console.log('getting url ' + url);
  request.get({url: url,
    json: true,
    headers: {"X-Hardware-Name": config.name, "X-Hardware-Token": config.token}},
    function(error, response, body) {
      if (!error && response.statusCode === 200) {
        console.log('body is ' + util.inspect(body))
        print_paper_ticket(body.data.attributes.code, data.event_name);

        mainWindow.webContents.once('did-finish-load', () => {
          mainWindow.webContents.send('tried-to-print', {code: body.data.attributes.code, event_name: data.event_name});
        });
      } else {

        mainWindow.webContents.send('send-errors', {code: response.statusCode, error_message: body.error.message} );

      }
    });
});

async function stop_polling() {
  // console.log('trying to stop polling on ' + JSON.stringify(device.name));
  is_polling = false;

  }

ipcMain.on('open-guest-ticket-screen', () => {
  latest = []
  latest.push('file://' + __dirname + '/app/themes/' + config.theme + '/guest_ticket.html');
  mainWindow.loadURL(latest[0]);
  let events = events_today((e) => {
    mainWindow.webContents.once('did-finish-load', () => {
      mainWindow.webContents.send('load-events', e);
    });
  });
});

module.exports = {
 stop_polling : stop_polling,
 go: go
}
