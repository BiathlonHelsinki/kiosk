let {ipcRenderer} = require('electron');

var idleTime = 0;
$(document).ready(function () {
  display_ct();

  check_reader();
  // 
  if ($('#flash').html() == '') {
    $('#flash').css('display', 'none');
  }
    //Increment the idle time counter every minute.
    var idleInterval = setInterval(timerIncrement, 60000); // 1 minute

    //Zero the idle timer on mouse movement.
    $(this).mousemove(function (e) {
        idleTime = 0;
    });
    $(this).keypress(function (e) {
        idleTime = 0;
    });
});

function timerIncrement() {
    idleTime = idleTime + 1;
    if (idleTime > 0) { // 20 minutes
      ipcRenderer.send('activate-screensaver');
      
      // window.location.href = 'splash.html';
    }
}

function check_reader() {

  ipcRenderer.send('query-reader-status');
}

setInterval(check_reader, 5000);

ipcRenderer.on('reader-reply', (event, data) => {
  if (data == true) {
    $('#reader_status').text('polling...');
  } else {
    $('#reader_status').text('not polling.');
  }

});

ipcRenderer.on('reader-status', (event, data) =>  {
  $('#reader_status').text(data);
});

ipcRenderer.once('present-flash', (event, data) =>  {
  console.log('data is ' + data);
  if (data !== null) {
    $("#flash").html(data);
    $('#flash').css('display', 'block');
  }
  ipcRenderer.send('present-flash', null);
  // ipcRenderer.removeAllListeners('preset-flash');
});

function display_c(){
  var refresh=1000; // Refresh rate in milli seconds
  mytime=setTimeout('display_ct()',refresh)
}

function display_ct() {
  var strcount
  var x = new Date().toDateString();
  var y = new Date().toLocaleTimeString();
  document.getElementById('ct').innerHTML = x + " " + y;
  tt=display_c();
}