/*set up the static file server*/

/* include static file webserver library */

var static = require('node-static');

/* include the http server library */
var http = require('http');

/* assume that we are running on Heroku */
var port = process.env.PORT;
var directory = __dirname + '/public';

/* if we aren't on heroku, then we need to readjust the port and directory information and we know that because port won't be set */
if (typeof port == 'undefined' || !port){
    directory = './public';
    port = 8080;
}
/* set up static web-server that will deliver files from the filesystem */
var file = new static.Server(directory);

/* construct an http server that gets files from the files server*/
var app = http.createServer(
    function(request, response){
        request.addListener('end',
            function(){
                file.serve(request,response);
            }
        ).resume();
    }
).listen(port);

console.log('The server is running');


/* set up the web socket server*/
/*  a registry of socket_ids and player information */
var players = [];

var io = require('socket.io').listen(app);
io.sockets.on('connection', function(socket){
    log('Client connect by ' + socket.id);
    function log(){
        var array = ['*** Server log Message: '];
        for (var i = 0; i < arguments.length; i++){
            array.push(arguments[i]);
            console.log(arguments[i]);
        }
        socket.emit('log', array);
        socket.broadcast.emit('log', array);
    }



    /* join room command*/
    /* payload:
    { 
        room: room to join,
        username: username of person joining
    }
    join_room_response {
        results: success,
        room: room joined,
        username: username that joined,
        socket_id: the socket id of the person that joined
        membership: number of people in the room including the new one. 
    } or 
    {
        results: fail,
        message: fail message;
    }
    */
    socket.on('join_room', function(payload){
        log('\'join_room\' command' + JSON.stringify(payload));
        /* check that the client sent a payload*/
        if (('underfined' === typeof payload) || !payload){
            var error_message = 'join_room ha no payload, command aborted';
            log(error_message);
            socket.emit('join_room_response', {
                result: 'fail',
                message: error_message
            });
            return
        }
        /* check that payload has room to join */
        var room =payload.room;
        if (('underfined' === typeof room) || !room){
            var error_message = 'join_room didn\'t specify a room, command aborted';
            log(error_message);
            socket.emit('join_room_response', {
                result: 'fail',
                message: error_message
            });
            return
        }
        /* check that a username has been provided*/
        var username =payload.username;
        if (('underfined' === typeof username) || !username){
            var error_message = 'join_room didn\'t specify a username, command aborted';
            log(error_message);
            socket.emit('join_room_response', {
                result: 'fail',
                message: error_message
            });
            return
        }
        /*Store information about this new player */
        players[socket.id] = {};
        players[socket.id].username = username;
        players[socket.id].room = room;

        /*have the user join the room */
        socket.join(room);
        /* get the room object */
        var roomObject = io.sockets.adapter.rooms[room];
        /* tell everyone in the room that someone just joined */
        var numClients = roomObject.length;
        var success_data = {
            result: 'success',
            room: room,
            username: username,
            socket_id: socket.id,
            membership: numClients
        };
        io.sockets.in(room).emit('join_room_response', success_data);

        for(var socket_in_room in roomObject.sockets){
            var success_data = {
                result: 'success',
                room: room,
                username: players[socket_in_room].username,
                socket_id: socket_in_room,
                membership: numClients
            };
            socket.emit('join_room_response', success_data);
        }

        log('join_room success');
        
        if (room !== 'lobby'){
            send_game_update(socket, room, 'initial update');
        }

    });


    /* when a web page disconnects alert everyone in the room */
    socket.on('disconnect', function(){
        log('client disconnected ' + JSON.stringify(players[socket.id]));
        if ( 'undefined' !== typeof players[socket.id] && players[socket.id]){
            var username = players[socket.id].username;
            var room = players[socket.id].room;
            var payload = {
                username: username,
                socket_id: socket.id
            };
            delete players[socket.id];
            io.in(room).emit('player_disconnected', payload);
        }
    });

    /* send_message command*/
    /* payload:
    { 
        room: room to join,
        message: the message to send
    }
    send_message_response {
        results: success,
        username: username that joined,
        message: the message spoken;
    } or 
    {
        results: fail,
        message: fail message;
    }
    */

    socket.on('send_message', function(payload){
        log('server received a command', 'send_message', payload);
        if (('underfined' === typeof payload) || !payload){
            var error_message = 'send_message has no payload, command aborted';
            log(error_message);
            socket.emit('send_message_response', {
                result: 'fail',
                message: error_message
            }); 
            return
        }
        var room =payload.room;
        if (('underfined' === typeof room) || !room){
            var error_message = 'send_message didn\'t specify a room, command aborted';
            log(error_message);
            socket.emit('send_message_response', {
                result: 'fail',
                message: error_message
            });
            return
        }
        var username = players[socket.id].username;
        if (('underfined' === typeof username) || !username){
            var error_message = 'send_message didn\'t specify a username, command aborted';
            log(error_message);
            socket.emit('send_message_response', {
                result: 'fail',
                message: error_message
            });
            return
        }

        var message =payload.message;
        if (('underfined' === typeof message) || !message){
            var error_message = 'send_message didn\'t specify a message, command aborted';
            log(error_message);
            socket.emit('send_message_response', {
                result: 'fail',
                message: error_message
            });
            return
        }

        var success_data = {
            result : 'success',
            room: room,
            username: username,
            message: message
        };
    
        io.in(room).emit('send_message_response', success_data);
        log('Message sent to room ' + room + ' by ' + username);
    });


    
    /* invite command*/
    /* payload:
    { 
    requested_user: the socket id of the person to be invited,
    }
    invite_response {
        results: success,
        socket_id: the socket id of the username of the person being invited
    } or 
    {
        results: fail,
        message: fail message;
    }

    invited {
        results: success,
        socket_id: the socket id of the username of the person being invited
    }or 
    {
        results: fail,
        message: fail message;
    } 
    */

    socket.on('invite', function(payload){
        log('invite with ' + JSON.stringify(payload));
        /* check to make sure that a payload was sent */
        if (('underfined' === typeof payload) || !payload){
            var error_message = 'invite has no payload, command aborted';
            log(error_message);
            socket.emit('invite_response', {
                result: 'fail',
                message: error_message
            }); 
            return
        }
        /* check the message can be traced to a username */
        var username =players[socket.id].username;
        if (('underfined' === typeof username) || !username){
            var error_message = 'invite cannot identify who sent the message, command abort';
            log(error_message);
            socket.emit('invite_response', {
                result: 'fail',
                message: error_message
            });
            return
        }

        var requested_user =payload.requested_user;
        if (('underfined' === typeof requested_user) || !requested_user){
            var error_message = 'invite didnot specify a reuquested_user, command abort';
            log(error_message);
            socket.emit('invite_reponse', {
                result: 'fail',
                message: error_message
            });
            return
        }

        var room = players[socket.id].room;
        var roomObject = io.sockets.adapter.rooms[room];
        /* make sure the user being invited is in the room */
        if(!roomObject.sockets.hasOwnProperty(requested_user)){
            var error_message = 'invite reuquested a user that was not in the room, command abort';
            log(error_message);
            socket.emit('invite_reponse', {
                result: 'fail',
                message: error_message
            });
            return
        }
        /* if everything is okay reponsed to the inviter that it was sucessful*/

        var success_data = {
            result : 'success',
            socket_id: requested_user
        };
        socket.emit('invite_response', success_data);

        /* tell the invitee that they have been invited*/

        var success_data = {
            result : 'success',
            socket_id: socket.id,
        };
        socket.to(requested_user).emit('invited', success_data);
        log('invite successful');
    });

    /* UNinvite command*/
    /* payload:
    { 
    requested_user: the socket id of the person to be uninvited,
    }
    uninvite_response {
        results: success,
        socket_id: the socket id of the username of the person being uninvited
    } or 
    {
        results: fail,
        message: fail message;
    }

    uninvited {
        results: success,
        socket_id: the socket id of the username of the person being univited
    }or 
    {
        results: fail,
        message: fail message;
    } 
    */

    socket.on('uninvite', function(payload){
        log('uninvite with ' + JSON.stringify(payload));
        /* check to make sure that a payload was sent */
        if (('underfined' === typeof payload) || !payload){
            var error_message = 'uninvite has no payload, command aborted';
            log(error_message);
            socket.emit('uninvite_response', {
                result: 'fail',
                message: error_message
            }); 
            return
        }
        /* check the message can be traced to a username */
        var username =players[socket.id].username;
        if (('underfined' === typeof username) || !username){
            var error_message = 'uninvite cannot identify who sent the message, command abort';
            log(error_message);
            socket.emit('uninvite_response', {
                result: 'fail',
                message: error_message
            });
            return
        }

        var requested_user =payload.requested_user;
        if (('underfined' === typeof requested_user) || !requested_user){
            var error_message = 'uninvite didnot specify a reuquested_user, command abort';
            log(error_message);
            socket.emit('uninvite_reponse', {
                result: 'fail',
                message: error_message
            });
            return
        }

        var room = players[socket.id].room;
        var roomObject = io.sockets.adapter.rooms[room];
        /* make sure the user being invited is in the room */
        if(!roomObject.sockets.hasOwnProperty(requested_user)){
            var error_message = 'invite reuquested a user that was not in the room, command abort';
            log(error_message);
            socket.emit('invite_reponse', {
                result: 'fail',
                message: error_message
            });
            return
        }
        /* if everything is okay reponsed to the uninviter that it was sucessful*/

        var success_data = {
            result : 'success',
            socket_id: requested_user
        };
        socket.emit('uninvite_response', success_data);

        /* tell the uninvitee that they have been uninvited*/

        var success_data = {
            result : 'success',
            socket_id: socket.id,
        };
        socket.to(requested_user).emit('uninvited', success_data);
        log('uninvite successful');
    });



    /* game start command*/
    /* payload:
    { 
    requested_user: the socket id of the person to play with
    }
    game_start_response {
        results: success,
        socket_id: the socket id of the username of the person you are playing with
        game_id: id of the game session
    } or 
    {
        results: fail,
        message: fail message;
    } 
    */

    socket.on('game_start', function(payload){
        log('game_start with ' + JSON.stringify(payload));
        /* check to make sure that a payload was sent */
        if (('underfined' === typeof payload) || !payload){
            var error_message = 'game_start has no payload, command aborted';
            log(error_message);
            socket.emit('game_start_response', {
                result: 'fail',
                message: error_message
            }); 
            return
        }
        /* check the message can be traced to a username */
        var username =players[socket.id].username;
        if (('underfined' === typeof username) || !username){
            var error_message = 'game_start cannot identify who sent the message, command abort';
            log(error_message);
            socket.emit('game_start_response', {
                result: 'fail',
                message: error_message
            });
            return
        }

        var requested_user =payload.requested_user;
        if (('underfined' === typeof requested_user) || !requested_user){
            var error_message = 'game_start didnot specify a reuquested_user, command abort';
            log(error_message);
            socket.emit('game_start_response', {
                result: 'fail',
                message: error_message
            });
            return
        }

        var room = players[socket.id].room;
        var roomObject = io.sockets.adapter.rooms[room];
        /* make sure the user being invited is in the room */
        if(!roomObject.sockets.hasOwnProperty(requested_user)){
            var error_message = 'game_start reuquested a user that was not in the room, command abort';
            log(error_message);
            socket.emit('game_start_response', {
                result: 'fail',
                message: error_message
            });
            return
        }
        /* if everything is okay reponsed to the game starter that it was sucessful*/
        var game_id = Math.floor((1+Math.random()) * 0x10000).toString(16).substring(1);
        var success_data = {
            result : 'success',
            socket_id: requested_user,
            game_id: game_id
        };
        socket.emit('game_start_response', success_data);

        /* tell the other play to play*/

        var success_data = {
            result : 'success',
            socket_id: socket.id,
            game_id: game_id
        };
        socket.to(requested_user).emit('game_start_response', success_data);
        log('game_start successful');
    });

    /* play_token command*/
    /* payload:
    { 
        row: 0 - 7
        column: 0 - 7
        color: white or black
    }
    if success, will be followed by a game_update message 
    play_token_response {
        results: success,
    } or 
    {
        results: fail,
        message: fail message;
    } 
    */

    socket.on('play_token', function(payload){
        log('play_token with ' + JSON.stringify(payload));
        /* check to make sure that a payload was sent */
        if (('underfined' === typeof payload) || !payload){
            var error_message = 'Play_token has no payload, command aborted';
            log(error_message);
            socket.emit('play_token_response', {
                result: 'fail',
                message: error_message
            }); 
            return
        }
        /* check the player has previously registered */
        var player =players[socket.id];
        if (('underfined' === typeof player) || !player){
            var error_message = 'server does not recognize you, command abort';
            log(error_message);
            socket.emit('play_token_response', {
                result: 'fail',
                message: error_message
            });
            return
        }

        var username =players[socket.id].username;
        if (('underfined' === typeof username) || !username){
            var error_message = 'play_token cannot identify who sent the msg, command abort';
            log(error_message);
            socket.emit('play_token_response', {
                result: 'fail',
                message: error_message
            });
            return
        }

        var game_id =players[socket.id].room;
        if (('underfined' === typeof game_id) || !game_id){
            var error_message = 'play_token cannot find gameboard, command abort';
            log(error_message);
            socket.emit('play_token_response', {
                result: 'fail',
                message: error_message
            });
            return
        }

        var row = payload.row;
        if (('underfined' === typeof row) || row < 0 || row > 7){
            var error_message = 'play_token didnot specify valid row, command abort';
            log(error_message);
            socket.emit('play_token_response', {
                result: 'fail',
                message: error_message
            });
            return
        }

        var column = payload.column;
        if (('underfined' === typeof column) || column < 0 || column > 7){
            var error_message = 'play_token didnot specify valid column, command abort';
            log(error_message);
            socket.emit('play_token_response', {
                result: 'fail',
                message: error_message
            });
            return
        }

        var color = payload.color;
        if (('underfined' === typeof color) || !color || (color !== 'white' && color != 'black')){
            var error_message = 'play_token didnot specify valid color, command abort';
            log(error_message);
            socket.emit('play_token_response', {
                result: 'fail',
                message: error_message
            });
            return
        }
        /* get game state*/

        var game = games[game_id];
        if (('underfined' === typeof game) || !game){
            var error_message = 'play_token didnot find game board, command abort';
            log(error_message);
            socket.emit('play_token_response', {
                result: 'fail',
                message: error_message
            });
            return
        }

        /* if current attempt is out of turn then error */

        if(color !== game.whose_turn){
            var error_message = 'play_token message played out of turn';
            log(error_message);
            socket.emit('play_token_response', {
                result: 'fail',
                message: error_message
            });
            return
        }
        /* if the wrong socket is playing the color */
        if(
            ((game.whose_turn === 'white') && (game.player_white.socket !== socket.id)) || 
            ((game.whose_turn === 'black') && (game.player_black.socket !== socket.id))
        ){
            var error_message = 'play_token turn played by wrong player';
            log(error_message);
            socket.emit('play_token_response', {
                result: 'fail',
                message: error_message
            });
            return;
        }

        var success_data = {
            result: 'success'
        };


        socket.emit ('play_token_reponse', success_data);
        /* execute the move */
        if (color === 'white') {
            game.board[row][column] = 'w';
            flip_board('w', row, column, game.board);
            game.whose_turn = 'black';
            game.legal_moves = calculate_valid_moves('b', game.board);
        }
        else if (color === 'black'){
            game.board[row][column] = 'b';
            flip_board('b', row, column, game.board);
            game.whose_turn = 'white';
            game.legal_moves = calculate_valid_moves('w', game.board);
        }

        var d = new Date();
        game.last_move_time = d.getTime();

        send_game_update(socket, game_id, 'played a token');

    });

});

/********************* */
/* code related to the game state */
var games = [];

function create_new_game(){
    var new_game = {};
    new_game.player_white = {};
    new_game.player_black = {};
    new_game.player_white.socket = '';
    new_game.player_white.username = '';
    new_game.player_black.socket = '';
    new_game.player_black.username = '';

    var d = new Date();
    new_game.last_move_time = d.getTime();

    new_game.whose_turn = 'black';
    new_game.board = [
                        [' ',' ',' ',' ',' ',' ',' ',' '],
                        [' ',' ',' ',' ',' ',' ',' ',' '],
                        [' ',' ',' ',' ',' ',' ',' ',' '],
                        [' ',' ',' ','w','b',' ',' ',' '],
                        [' ',' ',' ','b','w',' ',' ',' '],
                        [' ',' ',' ',' ',' ',' ',' ',' '],
                        [' ',' ',' ',' ',' ',' ',' ',' '],
                        [' ',' ',' ',' ',' ',' ',' ',' ']
                    ];

    new_game.legal_moves = calculate_valid_moves('b', new_game.board);

    return new_game;
}

/* check if there is a color who on the line starting (r,c)
or anywhere further by adding dr and dc to (r,c)*/

function check_line_match(who, dr, dc, r, c, board) {
    if(board[r][c] === who){
        return true;
    }

    if(board[r][c] === ' '){
        return false;
    }
    
    if ( (r + dr < 0) || (r + dr > 7) ) {
        return false;
    }

    if ( (c + dc < 0) || (c + dc > 7) ) {
        return false;
    }

    return check_line_match(who, dr, dc, r+dr, c + dc, board);

}

/* check if the posiitin at r, c contains the opposite of "who" on the board
* and if the line indicated by adding dr to r and dc to c eventualy ends in the who color*/

function valid_move(who, dr, dc, r, c, board) {
    var other;
    if ( who === 'b'){
        other = 'w';
    }
    else if (who === 'w') {
        other = 'b';
    }
    else {
        log ('problem: ' + who);
        return false;
    }
    if ( (r + dr < 0) || (r+dr > 7) ) {
        return false;
    }
    
    if ( (c + dc < 0) || (c + dc > 7) ) {
        return false;
    }
    
    if (board[r + dr][c + dc] !== other) {
        return false;
    }

    if ( (r  +dr + dr < 0) || (r + dr + dr > 7) ) {
        return false;
    }
    
    if ( (c + dc + dc < 0) || (c + dc + dc > 7) ) {
        return false;
    }

    return check_line_match(who, dr, dc, r + dr + dr, c + dc + dc, board);

}

function calculate_valid_moves(who, board){
    var valid = [
                    [' ',' ',' ',' ',' ',' ',' ',' '],
                    [' ',' ',' ',' ',' ',' ',' ',' '],
                    [' ',' ',' ',' ',' ',' ',' ',' '],
                    [' ',' ',' ',' ',' ',' ',' ',' '],
                    [' ',' ',' ',' ',' ',' ',' ',' '],
                    [' ',' ',' ',' ',' ',' ',' ',' '],
                    [' ',' ',' ',' ',' ',' ',' ',' '],
                    [' ',' ',' ',' ',' ',' ',' ',' ']
                ];

    for (var row = 0; row < 8; row ++){
        for(var column = 0; column < 8; column ++){
            if (board[row][column] == ' '){
                nw = valid_move(who, -1, -1, row, column, board);
                nn = valid_move(who, -1, 0, row, column, board);
                ne = valid_move(who, -1, 1, row, column, board);
                
                ww = valid_move(who, 0, -1, row, column, board);
                ee = valid_move(who, 0, 1, row, column, board);

                sw = valid_move(who, 1, -1, row, column, board);
                ss = valid_move(who, 1, 0, row, column, board);
                se = valid_move(who, 1, 1, row, column, board);

                if (nw || nn || ne || ww || ee || sw || ss || se) {
                    valid[row][column] = who;
                }
                
            }
        }
    }
    return valid;
}

function flip_line (who, dr, dc, r, c, board){
    if ( (r + dr < 0) || (r+dr > 7) ) {
        return false;
    }
    
    if ( (c + dc < 0) || (c + dc > 7) ) {
        return false;
    }
    
    if (board[r + dr][c + dc] === ' ') {
        return false;
    }

    if (board[r + dr][c + dc] === who) {
        return true;
    }
    else {
        if(flip_line(who, dr, dc, r+dr, c+dc, board)){
            board[r+dr][c+dc] = who;
            return true;
        }
        else{
            return false;
        }
    }

}

function flip_board(who, row, column,board){
    flip_line(who, -1, -1, row, column, board);
    flip_line(who, -1, 0, row, column, board);
    flip_line(who, -1, 1, row, column, board);
                
    flip_line(who, 0, -1, row, column, board);
    flip_line(who, 0, 1, row, column, board);

    flip_line(who, 1, -1, row, column, board);
    flip_line(who, 1, 0, row, column, board);
    flip_line(who, 1, 1, row, column, board);
}

function send_game_update(socket, game_id, message) {
    /* check to see if a game with game_id already exist */
    if(('undefined' === typeof games[game_id]) || !games[game_id]){
        /*no game exist, so make one */
       console.log('no game exists. creating' + game_id + ' for ' + socket.id);
        games[game_id] = create_new_game();
    }


    /* make sure only 2  people are in the game room */
    var roomObject;
    var numClients;
    do {
        roomObject = io.sockets.adapter.rooms[game_id];
        numClients = roomObject.length;
        if(numClients > 2) {
            console.log ('too many clients in room: ' + game_id + ' #: ' + numClients);
            if(games[game_id].player_white.socket === roomObject.sockets[0]) {
                games[game_id].player_white.socket = '';
                games[game_id].player_white.username = '';
            }
            if(games[game_id].player_black.socket === roomObject.sockets[0]) {
                games[game_id].player_black.socket = '';
                games[game_id].player_black.username = '';
            }
            /* kick one of the extra people out */
            var sacrifice = Object.keys(roomObject.sockets)[0];
            io.of('/').connected[sacrifice].leave(game_id);

        }
    }
    while ((numClients - 1) > 2);

    /* assign this socket a color */
    /* if the current player isnt assigned a color */
    if((games[game_id].player_white.socket !== socket.id) && (games[game_id].player_black.socket !== socket.id)) {
        console.log ('player is not assigned a color: ' + socket.id);
        /* and there isn't a color to give them */
        if ((games[game_id].player_black.socket !== '') && (games[game_id].player_white.socket !== '')) {
            games[game_id].player_white.socket = '';
            games[game_id].player_white.username = '';
            games[game_id].player_black.socket = '';
            games[game_id].player_black.username = '';
        }
    }

    /* assign color to players if not done */
    if (games[game_id].player_white.socket === '') {
        if(games[game_id].player_black.socket !== socket.id) {
            games[game_id].player_white.socket = socket.id;
            games[game_id].player_white.username = players[socket.id].username;
        }
    }
    if (games[game_id].player_black.socket === '') {
        if(games[game_id].player_white.socket !== socket.id) {
            games[game_id].player_black.socket = socket.id;
            games[game_id].player_black.username = players[socket.id].username;
        }
    }

    /* send game update */
    var success_data = {
        result: 'success',
        game: games[game_id],
        message: message,
        game_id: game_id
    };
    io.in(game_id).emit('game_update', success_data);
    
    /* check to see if the game is over */
    var row, column;
    var count= 0;
    var black = 0;
    var white = 0;
    for (row = 0; row < 8; row ++){
        for(column = 0; column < 8; column ++){
            if (games[game_id].legal_moves[row][column] != ' '){
                count ++;
            }
            if (games[game_id].board[row][column] === 'b'){
                black ++;
            }
            if (games[game_id].board[row][column] === 'w'){
                white ++;
            }
        }
    }
    if (count  == 0) {
        /* send a game over message */
        var winner = 'tie game';
        if (black > white){
            winner = 'Black';
        }
        if (white > black ){
            winner = 'White';
        }
        var success_data = {
            result: 'success',
            game: games[game_id],
            who_won: winner,
            game_id: game_id
        };
        io.in(game_id).emit('game_over', success_data);
        /* delete old games after 1hr */
        setTimeout(function(id) {
            return function() {
                delete game[id];
            }
        }, (game_id), 60*60*1000);
    }
    
}