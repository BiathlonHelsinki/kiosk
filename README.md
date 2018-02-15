# kiosk
NFC-based check-in kiosk for Biathlon.

This is a component of the Biathlon toolkit, a not-quite-yet functional set of tools for running networked collaborative creative spaces with an emphasis on participation.

This kiosk is meant to be used if you are running a Biathlon node, which no one is doing at the moment. This means you have a local userbase, [website](https://github.com/BiathlonHelsinki/temporary), and [Biathlon API](https://github.com/BiathlonHelsinki/biathlon_rails_api) running. So it's not particularly useful at this moment. This will (hopefully) change.

The kiosk will read NFC tags of a Mifare Ultralight nature and query your local API to match the tag to a user. It will also write cards to your local Biathlon database via the same API. Users can then "check in" to Biathlon activities with their card and be awarded participation tokens on Ethereum.

Users without an account or card can print a 'guest ticket' if a small USB printer is hooked up. This guest ticket will generate a random code that can be entered on your website to redeem for participation tokens later.


### Requirements
This kiosk was tested in Helsinki on reasonably cheap hardware, using a Raspberry Pi 2 or 3, a PN532 NFC reader, a touchscreen, and a small thermal printer.

You should be able to run this on any device capable of connecting via libNFC. Thanks to Aurélien for his excellent [node-freefare](https://github.com/Alabate/node-freefare/) library.

The kiosk runs on [electron](http://electron.io).

### Themes
As you will want to customise the look of your kiosk, you can create your own HTML/CSS in the app/themes directory. If you would like to submit your own theme for some reason, submit a pull request. We provide the theme used for Temporary.

### Getting started
Copy config/config.yml.sample to config/config.yml and edit as needed.

### NFC tag standard
Version 1.0 of the [Biathlon API](https://github.com/BiathlonHelsinki/biathlon_rails_api) queries its local database for two codes: the tag ID, which is the first 3 pages of the Mifare tag, and the 'security key', which is a randomly generated hash in the fourth page of the tag.

Biathlon 2.0 uses the following format for NFC ID (currently only MiFare Ultralight are supported but this can change hen there is a good reason):


pages | data | notes
--- | --- | ---
0-2 | tag id | *(second half of page 2 is blank)*
3 | *unused* |
4 | randomly generated security code |
5-9 | Ethereum address of the parent Biathlon node | *(without preceding 0x, of course)*
10-14 | Ethereum address of the user  | *(without preceding 0x, of course)*
15 | *unused* |

### Caveat!
I realise it's confusing but when I refer to 'node' in the sense of Biathlon node, it means a site participating in the Biathlon toolkit, not node.js. Confusing, since this kiosk is built with electron which is built on node.js.

Oh, this is a rewrite of the original shitty GTK/Ruby kiosk that served Temporary Helsinki from September 2016 until April 2017. This electron-based one was used until Temporary closed in August 2017.

Biathlon is obviously a very specialised and idiosyncratic environment that is being presented piecemeal here. If you are interested in ripping out components of this kiosk to use for your own needs (ie: not using the Biathlon components but keeping the NFC cardreading stuff), go ahead, and feel free to ask for help in the Issues here.
