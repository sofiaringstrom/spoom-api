import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import querystring from 'querystring';
import cookieParser from 'cookie-parser';

const io = require('socket.io')();

require('dotenv').config();

/**
 * Generates a random string containing numbers and letters
 * @param  {number} length The length of the string
 * @return {string} The generated string
 */
var generateRandomString = function(length) {
  var text = '';
  var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

  for (var i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
};

var stateKey = 'spotify_auth_state';

const app = express();
const PORT = process.env.PORT;
const SOCKET_PORT = process.env.SOCKET_PORT;
const path = require('path');
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const SPOTIFY_REDIRECT_URL = process.env.SPOTIFY_REDIRECT_URL;

app.listen(PORT, () => {
  console.log(`server running on port ${PORT}`)
});

app.use(express.static(__dirname + '/public'))
   .use(cors())
   .use(cookieParser());

app.use(bodyParser.urlencoded({ extended: true }))
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*")
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept")
  next()
})
app.use(bodyParser.json());

app.get('/',function(req,res) {
  console.log(req.query.code)

  if (req.query.code) {
    // code is present
    res.sendFile(path.join(__dirname+'/auth.html'));
  } else {
    // code is not present, pls enter
    res.sendFile(path.join(__dirname+'/enter-code.html'));
  }

  //res.sendFile(path.join(__dirname+'/index.html'));
});

app.get('/login', function(req, res) {

  var state = generateRandomString(16);
  res.cookie(stateKey, state);

  // your application requests authorization
  var scope = 'user-read-private playlist-read-private';
  res.redirect('https://accounts.spotify.com/authorize?' +
    querystring.stringify({
      response_type: 'code',
      client_id: SPOTIFY_CLIENT_ID,
      scope: scope,
      redirect_uri: SPOTIFY_REDIRECT_URL,
      state: state
    }));
});

app.get('/done',function(req,res) {
  res.sendFile(path.join(__dirname+'/done.html'));
});

io.listen(SOCKET_PORT);

io.on('connection', (client) => {
  // here you can start emitting events to the client 
  console.log('connection io')

  client.on('subscribeToTimer', (interval) => {
    console.log('client is subscribing to timer with interval ', interval);

    setInterval(() => {
      client.emit('timer', 'test');
    }, interval);
  });
});