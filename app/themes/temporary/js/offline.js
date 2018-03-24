let {ipcRenderer} = require('electron');

$(document).ready(function () {
  let closeEl = document.querySelector('#quit_kiosk');

  closeEl.addEventListener('click', function() {
    ipcRenderer.send('close-main-window');
  });

});