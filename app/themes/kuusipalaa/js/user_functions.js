let mainMenu = document.querySelector('#main_menu');

mainMenu.addEventListener('click', function() {
  ipcRenderer.send('main-screen');
});


ipcRenderer.on('load-user-info-2', (event, data) => {
  console.log('data is ' + data);
  $("#person_field").html(data.username);
  $('#user_id').html(data.id);
  let image = data.attributes.avatar.avatar.small.url.replace(/development/, 'production');
  if (/transparent\.gif$/.test(image)) {
    image = 'https://kuusipalaa.fi/icons/user_missing.png';
  }

  $("#image_field").attr("src", image);
  $("#latest_balance").html(data.attributes["latest_balance"] + 'ᵽ');
  $("#last_checked_in").html(data.attributes["last_attended"].title + ', ' + data.attributes["last_attended_at"]);
  if (data.attributes['is_stakeholder?'] == true) {
    $('#stakeholder').css('display', 'block')
  }
  ipcRenderer.send('just-linked-card');
});


ipcRenderer.on('load-events', (event, data) => {
  $('#events').html('');
  let now = new Date();
  // console.log('events are ' + JSON.stringify(data));
  for (let i = 0; i < data.length; i++) {
    $('#events').append($('<button></button>').
      prop('id', data[i].attributes.slug).
      html(
        $('<img>').attr({src: data[i].attributes.image.image.thumb.url.replace(/development/, 'production').replace(/\/assets\/transparent\.gif/, 'img/kplogo.gif')})
        ).append($('<div></div>').attr({class: 'title'}).text(
        data[i].attributes.name))
        .append($('<div class="so_far"></div').text(data[i].attributes["checked_in_so_far"] + ' checked in today'))
        .append($('<div class="temps"></div').text(data[i].attributes["cost_bb"] + "ᵽ"))
          ).append($('<br />'));
          if (new Date(data[i].attributes["end-at"]) < now)  {
            $('#' + data[i].attributes.slug).addClass('inactive').attr('disabled', 'disabled');
            $('#' + data[i].attributes.slug + " .title").append($('<div></div>').attr({class: 'inactive'}).text('ended at ' + new Date(data[i].attributes["end-at"]).toLocaleTimeString().replace(/:\d+$/, ' ')));

          } else if (new Date(data[i].attributes["start-at"]) > now)  {
            $('#' + data[i].attributes.slug).addClass('inactive').attr('disabled', 'disabled');
            $('#' + data[i].attributes.slug + " .title").append($('<div></div>').attr({class: 'inactive'}).text('starts at ' + new Date(data[i].attributes["start-at"]).toLocaleTimeString().replace(/:\d+$/, ' ')));

          }
          //  {




    document.querySelector('#' + data[i].attributes.slug).addEventListener('click', function() {
  ipcRenderer.send('check-in', {user_id: $('#user_id').text(), user_name: $('#person_field').text(), event: data[i].attributes.slug});
    });
  }


});
