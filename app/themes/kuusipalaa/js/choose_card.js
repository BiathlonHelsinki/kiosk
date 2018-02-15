
let mainMenu = document.querySelector('#main_menu');

mainMenu.addEventListener('click', function() {
  ipcRenderer.send('main-screen');
});

let searchMenu = document.querySelector('#search_menu');

searchMenu.addEventListener('click', function() {
  ipcRenderer.send('link-new-card');
});

function set_up_pin() {
  $('#results option').click(() => {
    $('#enter_pin_wrapper').fadeIn();

  })
}

function set_up_results() {

    $('#lower').html('Place an ID card against the reader and click the link button above to link a card for ' + $(this).html());
    $('button#link_to_blank_card').fadeIn();

}
  
var link_button = document.querySelector('#link_to_blank_card');

link_button.addEventListener('click', function() {
  let pin = $('#enter_pin_hidden').val();
  let selected_is = $('#results').val();
  ipcRenderer.send('write-to-id', selected_is, pin);
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
        
        if (data[key].attributes['has-pin'] == false) {
          badge.setAttribute('disabled', 'disabled')
        } 
        document.getElementById('results').appendChild(badge);
      }
    }
    set_up_pin();
    
  } else {
    $('#results').html('Sorry, nothing matched that, Please try again.');
  }
});