let {ipcRenderer} = require('electron');


ipcRenderer.once('present-flash', (event, data) =>  {

  if (data !== null) {
    $("#flash").html(data);
    $('#flash').css('display', 'block');
  }
  ipcRenderer.send('present-flash', null);
  // ipcRenderer.removeAllListeners('preset-flash');
});


$(document).ready(function () {
  let closeEl = document.querySelector('#quit_kiosk');

  closeEl.addEventListener('click', function() {
    ipcRenderer.send('close-main-window');
  });

  let mainMenu = document.querySelector('#main_menu');

  mainMenu.addEventListener('click', function() {
    ipcRenderer.send('main-screen');

  });

  setTimeout(function() {
    ipcRenderer.send('main-screen');
  }, 6000);

});
