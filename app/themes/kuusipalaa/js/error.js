let mainMenu = document.querySelector('#main_menu');

mainMenu.addEventListener('click', function() {
  ipcRenderer.send('main-screen');
});

ipcRenderer.on('load-error', (event, data) => {
  $("#error_message").html(data);
  $('.progress-bar-fill').fadeIn();
  $('.progress-bar-fill').delay(10).queue(function () {
    $(this).css('width', '100%')
  });
})