let mainMenu = document.querySelector('#main_menu');

mainMenu.addEventListener('click', function() {
  ipcRenderer.send('main-screen');
});

function logo_blip() {
  $('#printed_ok').toggle();
  $('.loading').toggle();
  
}

ipcRenderer.on('tried-to-print', (event, data) => {
  $('.loading').toggle();
  $('#printed_ok').fadeIn();
  $('#ticket_id').text(data.code);
  let yesbutton = document.querySelector('#printed_yes');
  let nobutton = document.querySelector('#printed_no');

  yesbutton.addEventListener('click', function() {
    ipcRenderer.send('main-screen');
  });
  
  nobutton.addEventListener('click', function() {
    logo_blip();
    setTimeout(logo_blip, 3000);
    ipcRenderer.send('reprint', {code: data.code, event_name: data.event_name});
  });
});