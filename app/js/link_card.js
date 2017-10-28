

let mainMenu = document.querySelector('#main_menu');

mainMenu.addEventListener('click', function() {
  ipcRenderer.send('main-screen');

});

$('#submit_search').click(function() {
  var searchterm = $('#text_search').val();
  ipcRenderer.send('search-for-card', searchterm);

});
