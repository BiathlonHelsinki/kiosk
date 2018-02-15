let mainMenu = document.querySelector('#main_menu');

mainMenu.addEventListener('click', function() {
  ipcRenderer.send('main-screen');
});

ipcRenderer.on('load-user-info-2', (event, data) => {
  $("#person_field").html(data.attributes.username);
  $('#user_id').html(data.id);
  let image = data.attributes.avatar.avatar.small.url.replace(/development/, 'production');
  if (/transparent\.gif$/.test(image)) {
    image = 'https://temporary.fi/icons/user_missing.png';
  }
  $("#image_field").attr("src", image);
  $("#latest_balance").html(data.attributes["latest-balance"]);
  $("#last_checked_in").html(data.attributes["last-attended"].title + ', ' + data.attributes["last-attended-at"]);
  $('.progress-bar-fill').fadeIn();
  $('.progress-bar-fill').delay(10).queue(function () {
    $(this).css('width', '100%')
  });
  ipcRenderer.send('ready-to-upgrade', data.id);
});

ipcRenderer.on('load-user-info', (event, data) => {
  // console.log('data is ' + JSON.stringify(data));
  $("#person_field").html(data.attributes.username);
  $('#user_id').html(data.id);
  let image = data.attributes.avatar.avatar.small.url.replace(/development/, 'production');
  if (/transparent\.gif$/.test(image)) {
    image = 'https://temporary.fi/icons/user_missing.png';
  }
  $("#image_field").attr("src", image);
  $("#latest_balance").html(data.attributes["latest-balance"]);
  $("#last_checked_in").html(data.attributes["last-attended"].title + ', ' + data.attributes["last-attended-at"]);
  ipcRenderer.send('just-linked-card');
});
