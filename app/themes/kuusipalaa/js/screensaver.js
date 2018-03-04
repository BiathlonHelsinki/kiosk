let {ipcRenderer} = require('electron');

function changeBackground(data){
  $('#screensaver_div').css('background-image', 'url(' + data[index] + ')');
  index += 1;
  if (index > data.length) {
    index = 0;
  }
}


let index = 1;
ipcRenderer.once('send-screensaver-files', (event, data) =>  {
  console.log('data is ' + JSON.stringify(data));

    changeBackground(data);
    window.setInterval(function() {
      changeBackground(data)}, 8000);

});

$('#return').on('click', () => {
  ipcRenderer.send('main-screen')
})
