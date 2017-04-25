
let mainMenu = document.querySelector('#main_menu');

mainMenu.addEventListener('click', function() {
  ipcRenderer.send('main-screen');
});

let searchMenu = document.querySelector('#search_menu');

searchMenu.addEventListener('click', function() {
  ipcRenderer.send('link-new-card');
});


function set_up_results() {
  $('#results option').click(function() {
    $('#lower').html('Place an ID card against the reader and click the link button above to link a card for ' + $(this).html());
    $('button#link_to_blank_card').fadeIn();
  });
}
  
var link_button = document.querySelector('#link_to_blank_card');

link_button.addEventListener('click', function() {

  var selected_is = $('#results').val();
  ipcRenderer.send('write-to-id', selected_is);
});  

require('electron').ipcRenderer.on('load-matches', (event, data) => {
  if(data !== null) {  
    if(data.length > 0){  
      for (var key in data) {
        var id = data[key].id;
        var badge = document.createElement('option');
        let name = ''
        if (data[key].attributes.name == null) {
          name = data[key].attributes.username;
        } else {  
          name = data[key].attributes.name + " (" + data[key].attributes.username + ")";
        }
        badge.innerHTML = id + ' / ' + name + ' / ' + data[key].attributes.email;
        badge.setAttribute('value', id);
        document.getElementById('results').appendChild(badge);
      }
    }
    set_up_results();
    
  } else {
    $('#results').html('Sorry, nothing matched that, Please try again.');
  }
});