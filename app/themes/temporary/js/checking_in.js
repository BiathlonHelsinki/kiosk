let mainMenu = document.querySelector('#main_menu');

mainMenu.addEventListener('click', function() {
  ipcRenderer.send('main-screen');
});

let mainMenu2 = document.querySelector('#main_menu2');

mainMenu2.addEventListener('click', function() {
  ipcRenderer.send('main-screen');
});

ipcRenderer.once('load-checkin-info', (event, data) => {

  $('#user_name').text(data.name);
  $('#event_name').text(data.event);
  ipcRenderer.send('send-to-blockchain', {name: data.id, event: data.event});
});

ipcRenderer.once('send-errors', (event, data) => {

  $('#checking_in').css('display', 'none');
  $('#error_message').text(data.error_message);
  $('#errors').css('display', 'block');
  

  // ipcRenderer.send('send-to-blockchain', {name: data.name, event: data.event});
});

ipcRenderer.once('successful-checkin', (event, data) =>  {
  $('#person_field').text(data.name);
  $('#image_field').attr('src', data.image_url.replace(/development/, 'production'));
  $('#latest_balance').text(data.latest_balance);
  $('#last_attended').text(data.last_attended);
  $('#events_count').text(data.events_attended);
  $('#checking_in').css('display', 'none');
  $('#checked_in').css('display', 'block');
});