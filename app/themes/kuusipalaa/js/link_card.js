$('input').mlKeyboard({layout: 'fi_FI'});

let mainMenu = document.querySelector('#main_menu');

mainMenu.addEventListener('click', function() {
  ipcRenderer.send('main-screen');

});

ipcRenderer.on('get-error', (event, data) => {
  $('#error_message').html(data)
});

$('#submit_search').click(function() {
  var searchterm = $('#text_search').val();
  ipcRenderer.send('search-for-card', searchterm);

});
