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
        socket.broadcast.emit('log, array');
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
    }
    );

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
    username: username of person sending the message;
    message: the message to send
}
join_room_response {
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
        var username =payload.username;
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
    
        io.sockets.in(room).emit('send_message_response', success_data);
        log('Message sent to room ' + room + ' by ' + username);
    }
    );
});

