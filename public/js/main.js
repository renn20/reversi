
/* function for general use */

function GetUrlParameters (whichParam) {
    var pageURL = window.location.search.substring(1);
    var pageURLVariables = pageURL.split('&');
    for (var i = 0; i < pageURLVariables.length; i ++){
        var parameterName = pageURLVariables[i].split('=');
        if(parameterName[0] === whichParam) {
            return parameterName[1];
        }
    }
}

var username = GetUrlParameters('username');
if('undefined' == typeof username || !username){
    username = 'Anonymous_'+Math.random();
}

var chat_room = GetUrlParameters('game_id');
if('undefined' == typeof chat_room || !chat_room){
    chat_room = 'lobby';
}


/* connect to the socket server */
var socket = io.connect();

socket.on('log', function(array){
    console.log.apply(console.array);
});

/* what to do when someone joined a room */
socket.on('join_room_response', function(payload){
    if(payload.result === 'fail') {
        alert(payload.message);
        return;
    }
    /* if we are being notified that we joined the room, then ignore it*/
    if(payload.socket_id == socket.id){
        return;
    }

    /* if someone joined then add a new row to the lobby table */
    var dom_elements = $('.socket_' + payload.socket_id);
    /* if we don't have an entry for this person */
    if(dom_elements.length == 0){
        var nodeA = $('<div></div>');
        nodeA.addClass('socket_' + payload.socket_id);
        var nodeB = $('<div></div>');
        nodeB.addClass('socket_' + payload.socket_id);
        var nodeC = $('<div></div>');
        nodeC.addClass('socket_' + payload.socket_id);


       
        nodeB.addClass('col text-left play-name');
        nodeB.append(payload.username);

        nodeC.addClass('col text-right');
        var buttonC = makeInviteButton(payload.socket_id);
        nodeC.append(buttonC);

        nodeA.hide();
    
        nodeA.addClass('row play-list-item')
        nodeA.append(nodeB, nodeC);


        $('#players').append(nodeA);
        nodeA.slideDown(1000);

    } 
    /* if we hae seen the person who just joined (something wierd happend)*/
    else {
        uninvite(payload.socket_id);
        var buttonC = makeInviteButton(payload.socket_id);
        $('.socket_' + payload.socket_id + ' button').replaceWith(buttonC);
        dom_elements.slideDown(1000);
    }

    /*manage the message that a new player has joined*/
    var newHTML = '<p>' + payload.username + ' just entered the room</P>';
    var newNode = $(newHTML);
    newNode.hide();
    $('#messages').prepend(newNode);
    newNode.show();
});

/* what to do when the server says someone has left */
socket.on('player_disconnected', function(payload){
    if(payload.result === 'fail') {
        alert(payload.message);
        return;
    }
    /* if we are being notified that we left the room, then ignore it*/
    if(payload.socket_id == socket.id){
        return;
    }

    /* if someone left the room, then animate out all the contents */
    var dom_elements = $('.socket_' + payload.socket_id);

    /* in something exsist*/
    if(dom_elements.length !== 0){
       dom_elements.slideUp(1000);
    }

    /*manage the message that a a play has left*/
    var newHTML = '<p>' + payload.username + ' just left the lobby</P>';
    var newNode = $(newHTML);
    newNode.hide();
    $('#messages').prepend(newNode);
    newNode.show();
});

/* send an invite message to the server */
function invite(who){
    var payload = {};
    payload.requested_user = who;
    console.log( '*** Client Log Message: \'invite\' payload: ' + JSON.stringify(payload));
    socket.emit('invite', payload);
}

/* handle a reponse after sending an invite message to the server*/

socket.on('invite_response', function(payload){
    if(payload.result === 'fail'){
        alert(payload.message);
        return;
    }
    var newNode = makeInvitedButton (payload.socket_id);
    $('.socket_' + payload.socket_id + ' button').replaceWith(newNode);
});
/*handle a notification that we have been invited*/
socket.on('invited', function(payload){
    if(payload.result === 'fail'){
        alert(payload.message);
        return;
    }
    var newNode = makePlayButton(payload.socket_id);
    $('.socket_' + payload.socket_id + ' button').replaceWith(newNode);
});

/* send an UNinvite message to the server */
function uninvite(who){
    var payload = {};
    payload.requested_user = who;
    console.log( '*** Client Log Message: \'uninvite\' payload: ' + JSON.stringify(payload));
    socket.emit('uninvite', payload);
}

/* handle a reponse after sending an UNinvite message to the server*/

socket.on('uninvite_response', function(payload){
    if(payload.result === 'fail'){
        alert(payload.message);
        return;
    }
    var newNode = makeInviteButton (payload.socket_id);
    $('.socket_' + payload.socket_id + ' button').replaceWith(newNode);
});
/*handle a notification that we have been uninvited*/
socket.on('uninvited', function(payload){
    if(payload.result === 'fail'){
        alert(payload.message);
        return;
    }
    var newNode = makeInviteButton(payload.socket_id);
    $('.socket_' + payload.socket_id + ' button').replaceWith(newNode);
});


/* send an game start message to the server */
function game_start(who){
    var payload = {};
    payload.requested_user = who;
    console.log( '*** Client Log Message: \'game_start\' payload: ' + JSON.stringify(payload));
    socket.emit('game_start', payload);
}

/*handle a notification that we have been engaged*/
socket.on('game_start_response', function(payload){
    if(payload.result === 'fail'){
        alert(payload.message);
        return;
    }
    var newNode = makeEngagedButton(payload.socket_id);
    $('.socket_' + payload.socket_id + ' button').replaceWith(newNode);

    /* jump to a new page */
    window.location.href = 'game.html?username=' + username + '&game_id=' + payload.game_id;
});

function send_message() {
    var payload = {};
    payload.room = chat_room;
    payload.message = $('#send_message_holder').val();
    console.log('*** Client Log Message: \'send_message\' payload: '+JSON.stringify(payload));
    socket.emit('send_message', payload);
    $('#send_message_holder').val('');
}


socket.on('send_message_response', function(payload){
    if(payload.result === 'fail') {
        alert(payload.message);
        return;
    }
    var newHTML = '<p><b>' + payload.username + ' says:</b> ' +  payload.message + '</p>';
    var newNode = $(newHTML);
    newNode.hide();
    
    $('#messages').prepend(newNode);
    newNode.show();

});


function makeInviteButton (socket_id) {
    var newHTML = '<button type=\'button\' class=\'btn btn-main invite\'>Invite</button>';
    var newNode = $(newHTML);
    newNode.click(function(){
        invite(socket_id);
    });
    return (newNode);
}

function makeInvitedButton (socket_id) {
    var newHTML = '<button type=\'button\' class=\'btn btn-main invited\'>Invited</button>';
    var newNode = $(newHTML);
    newNode.click(function(){
        uninvite(socket_id);
    });
    return (newNode);
}

function makePlayButton (socket_id) {
    var newHTML = '<button type=\'button\' class=\'btn btn-main play\'>play</button>';
    var newNode = $(newHTML);
    newNode.click(function(){
        game_start(socket_id);
    });
    return (newNode);
}

function makeEngagedButton () {
    var newHTML = '<button type=\'button\' class=\'btn btn-danger\'>Engaged</button>';
    var newNode = $(newHTML);
    return (newNode);
}

$(function(){
    var payload = {};
    payload.room = chat_room;
    payload.username = username;
    
    console.log('*** Client Log Message: \'join_room\' payload: '+JSON.stringify(payload));
    socket.emit('join_room', payload);

    $('#quit').append('<a href="lobby.html?username=' + username + '" class="btn btn-danger btn-default active" role="button" aria-pressed="true">Quit</a>');

});

var old_board = [ 
                    ['?','?','?','?','?','?','?','?'],
                    ['?','?','?','?','?','?','?','?'],
                    ['?','?','?','?','?','?','?','?'],
                    ['?','?','?','?','?','?','?','?'],
                    ['?','?','?','?','?','?','?','?'],
                    ['?','?','?','?','?','?','?','?'],
                    ['?','?','?','?','?','?','?','?'],
                    ['?','?','?','?','?','?','?','?']
                ];
var my_color = ' ';
var interval_timer;

socket.on('game_update', function(payload){
    console.log('*** Client Log Message: \'join_room\' payload: '+JSON.stringify(payload));
    /* check for agood board update */
    if(payload.result === 'fail') {
        console.log(payload.message);
        window.location.href = 'lobby.html?username=' + username;
        return;
    }
    /* check for a good board in the payload*/
    var board = payload.game.board;
    if('undefined' === typeof board || !board) {
        console.log('received a malformed board update from the server');
        return;
    }
    /* update my color*/
    if(socket.id === payload.game.player_purple.socket) {
        my_color = 'purple';
    } else if (socket.id == payload.game.player_black.socket) {
        my_color = 'black';
    } else {
        /* something wierd going on */
        /* send client back to the lobby */
        window.location.href = 'lobby.html?username=' + username;
        return;
    }
    
    $('#my_color').html('<div id="my_color">I am ' + my_color + '</div>');
    $('#my_color').append('<div>It is ' + payload.game.whose_turn + '\'s turn. Elapsed time <span id="elapsed"></span></div>');
    clearInterval(interval_timer);
    interval_timer = setInterval(function(last_time){
        return function(){
            //do the work of updating ui
            var d = new Date();
            var elapsedmilli = d.getTime() - last_time;
            var minutes = Math.floor(elapsedmilli / (60 * 1000));
            var seconds = Math.floor((elapsedmilli % (60 * 1000)) / 1000);
            if(seconds < 10){
                $('#elapsed').html(minutes + ':0' + seconds);
            }
            else {
                $('#elapsed').html(minutes + ':' + seconds);
            }
        }
    }(payload.game.last_move_time), 1000);


    /* animate changes to the board */
    var blacksum = 0;
    var purplesum = 0;
    var row, column;
    for (row = 0; row < 8; row ++){
        for(column = 0; column < 8; column ++){
            if(board[row][column] == 'b'){
                blacksum ++;
            }
            if(board[row][column] == 'p'){
                purplesum ++;
            }
            /* if a board space has changed */
            if (old_board[row][column] !=board [row][column]){
                if(old_board[row][column] == '?' && board[row][column] == ' '){
                    $('#' + row + '_' + column).html('<img src="assets/images/empty.png" alt="empty Sqaure"/>');
                }
                else if(old_board[row][column] == '?' && board[row][column] == 'p'){
                    $('#' + row + '_' + column).html('<img src="assets/images/emptytowhite.gif" alt="purple Sqaure"/>');
                }
                else if(old_board[row][column] == '?' && board[row][column] == 'b'){
                    $('#' + row + '_' + column).html('<img src="assets/images/emptytoblack.gif" alt="black Sqaure"/>');
                }
                else if(old_board[row][column] == ' ' && board[row][column] == 'p'){
                    $('#' + row + '_' + column).html('<img src="assets/images/emptytowhite.gif" alt="purple Sqaure"/>');
                }
                else if(old_board[row][column] == ' ' && board[row][column] == 'b'){
                    $('#' + row + '_' + column).html('<img src="assets/images/emptytoblack.gif" alt="black Sqaure"/>');
                }
                else if(old_board[row][column] == 'p' && board[row][column] == ' '){
                    $('#' + row + '_' + column).html('<img src="assets/images/whitetoempty.gif" alt="empty Sqaure"/>');
                }
                else if(old_board[row][column] == 'b' && board[row][column] == ' '){
                    $('#' + row + '_' + column).html('<img src="assets/images/blacktoempty.gif" alt="empty Sqaure"/>');
                }
                else if(old_board[row][column] == 'p' && board[row][column] == 'b'){
                    $('#' + row + '_' + column).html('<img src="assets/images/whitetoblack.gif" alt="purple Sqaure"/>');
                }
                else if(old_board[row][column] == 'b' && board[row][column] == 'p'){
                    $('#' + row + '_' + column).html('<img src="assets/images/blacktowhite.gif" alt="black Sqaure"/>');
                }
                else {
                    $('#' + row + '_' + column).html('<img src="assets/images/error.gif" alt="error"/>');
                }
            }
            /* set up interactivities*/
            $('#' + row + '_' + column).off('click');
            $('#' + row + '_' + column).removeClass('hovered_over');
            //console.log(my_color.substr(0,1));
            if(payload.game.whose_turn === my_color){
               if(payload.game.legal_moves[row][column] === my_color.substr(0,1)){
                    $('#' + row + '_' + column).addClass('hovered_over');
                    $('#' + row + '_' + column).click(function(r,c){
                        return function () {
                            var payload = {};
                            payload.row = r;
                            payload.column = c;
                            payload.color = my_color;
                            console.log( '*** client log message: play_token payload: ' + JSON.stringify(payload));
                            socket.emit('play_token', payload);
                        };
                    }(row,column));
                }
            }
        }
    }
    $('#blacksum').html(blacksum);
    $('#purplesum').html(purplesum);
    old_board = board;

});

socket.on('play_token_response', function(payload){
    console.log('*** Client Log Message: \'play_token_response\' payload: '+JSON.stringify(payload));
    //console.log('this is ' + socket.id + ' ' + my_color + ' ');
    /* check for good play token response  */
    if(payload.result === 'fail') {
        console.log(payload.message);
        alert(payload.message);
        return;
    }
});

socket.on('game_over', function(payload){
    console.log('*** Client Log Message: \'game_over\' payload: '+JSON.stringify(payload));
    /* check for good play token response  */
    if(payload.result === 'fail') {
        console.log(payload.message);
        return;
    }
    /*jamp to a new page */
    $('#game_over').html('<h1>game over</h1><h2>' + payload.who_won + ' won!</h2>');
    $('#elapsed').hide();
    $('#game_over').append('<a href="lobby.html?username=' + username + '" class="btn btn-success btn-lg active" role="button" aria-pressed="true">Return to the lobby</a>');
;});


