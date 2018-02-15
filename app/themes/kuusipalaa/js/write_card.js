let mainMenu = document.querySelector('#main_menu');

mainMenu.addEventListener('click', function() {
  ipcRenderer.send('main-screen');
});

ipcRenderer.on('load-user-info', (event, data) => {
  $("#person_field").html(data.name);
  $('#pass_pin').val(data.pin)
  $("#image_field").attr("src", data.image_url.replace(/development/, 'production'));
  $('.progress-bar-fill').fadeIn();
  $('.progress-bar-fill').delay(10).queue(function () {
    $(this).css('width', '100%')
  });
  ipcRenderer.send('ready-to-write', data.id, data.pin);
});
