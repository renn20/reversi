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
var io = require('socket.io').listen(app);
io.sockets.on('connection', function(socket){
    function log(){
        var array = ['*** Server log Message: '];
        for (var i = 0; i < arguments.length; i++){
            array.push(arguments[i]);
            console.log(arguments[i]);
        }
        socket.emit('log', array);
        socket.broadcast.emit('log, array');
    }
    log('A web site connected to the server');
    socket.on('disconnect', function(socket){
        log('A web site disconnected to the server');
    }
    );
});