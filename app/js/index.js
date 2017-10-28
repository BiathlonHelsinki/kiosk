
let closeEl = document.querySelector('#quit_kiosk');

closeEl.addEventListener('click', function() {
  ipcRenderer.send('close-main-window');
});

let linkNewCard = document.querySelector('#link_new_card');

linkNewCard.addEventListener('click', function() {
  ipcRenderer.send('link-new-card');

});

let guest = document.querySelector('#guest_ticket');

guest.addEventListener('click', function() {

  ipcRenderer.send('open-guest-ticket-screen');
});

let cardservices_button = document.querySelector('#card_services');

cardservices_button.addEventListener('click', () => {
  ipcRenderer.send('open-card-services');
});
