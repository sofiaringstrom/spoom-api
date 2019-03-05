import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import querystring from 'querystring';
import cookieParser from 'cookie-parser';

let request = require('request')
const io = require('socket.io')();

require('dotenv').config();

var token_requests = {};

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
const FRONTEND_URI = process.env.FRONTEND_URI;

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
  //console.log(req.query.code) code from app

  if (req.query.access_token) {

    // Authorized
    console.log('authorized')

    let authOptionsSecond = {
      url: 'https://api.spotify.com/v1/me',
      headers: {
        'Authorization': 'Bearer ' + req.query.access_token
      }
    }

    request.get(authOptionsSecond, (error, response) => {
      console.log(response)
      return res.status(200).send({
        data: response
      })
    })

  } else if (req.query.code) {
    // code is present
    res.sendFile(path.join(__dirname+'/auth.html'));
  } else {
    // code is not present, pls enter
    res.sendFile(path.join(__dirname+'/enter-code.html'));
  }

});

app.get('/login', function(req, res) {

  var state = generateRandomString(16);
  res.cookie(stateKey, state);

  // your application requests authorization
  var scope = 'user-read-private playlist-read-private user-read-email';
  res.redirect('https://accounts.spotify.com/authorize?' +
    querystring.stringify({
      client_id: SPOTIFY_CLIENT_ID,
      response_type: 'code',
      scope: scope,
      redirect_uri: SPOTIFY_REDIRECT_URL,
      state: state
    }));
});

app.get('/done',function(req,res) {
  res.sendFile(path.join(__dirname+'/done.html'));
});

app.get('/callback', function(req, res) {
  console.log('callback')
  
  //var access_token = req.body.access_token;

  console.log('callback', req.query)

  let code = req.query.code || null
  let authOptions = {
    url: 'https://accounts.spotify.com/api/token',
    form: {
      code: code,
      redirect_uri: SPOTIFY_REDIRECT_URL,
      grant_type: 'authorization_code'
    },
    headers: {
      'Authorization': 'Basic ' + (new Buffer.from(
        SPOTIFY_CLIENT_ID + ':' + SPOTIFY_CLIENT_SECRET
      ).toString('base64'))
    },
    json: true
  }
  request.post(authOptions, function(error, response, body) {
    console.log('body', body)
    var access_token = body.access_token;
    var refresh_token = body.refresh_token;
    let uri = process.env.FRONTEND_URI || 'http://localhost:7000'

    // store tokens in app
    // then send tokens to api when requesting data from spotify
    var swotifyCode = req.cookies.swotify_code;
    token_requests[swotifyCode] = {'access_token': access_token, 'refresh_token': refresh_token};

    return res.status(200).send({
      status: 'ok'
    });

    //res.redirect(uri + '?access_token=' + access_token + '&refresh_token=' + refresh_token);
  })

  /*request.post(authOptions, function(error, response, body) {
    console.log(body)
    var access_token = body.access_token;
    var refresh_token = body.refresh_token;
    console.log(access_token)

    newToken = refresh_token;

    token_requests[code] = {'access_token': access_token, 'refresh_token': refresh_token};
    let uri = process.env.FRONTEND_URI || 'http://localhost:7000/callback';
    res.redirect(uri + '?access_token=' + access_token)
  })*/


  /*let authOptionsSecond = {
    url: 'https://api.spotify.com/v1/me',
    headers: {
      'Authorization': 'Bearer ' + newToken
    }
  }

  console.log(newToken)

  request.get(authOptionsSecond, (error, response) => {
    console.log(response)
  })*/

  /*let authOptions = {
    url: 'https://accounts.spotify.com/api/token',
    form: {
      code: access_token,
      redirect_uri: SPOTIFY_REDIRECT_URL,
      grant_type: 'authorization_code'
    },
    headers: {
      Accept: 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + (new Buffer.from(
        process.env.SPOTIFY_CLIENT_ID + ':' + process.env.SPOTIFY_CLIENT_SECRET
      ).toString('base64'))
    },
    json: true
  }*/
  /*request.post(authOptions, function(error, response, body) {
    console.log(body)
    var access_token = body.access_token;
    var refresh_token = body.refresh_token;
    console.log(access_token)

    token_requests[code] = {'access_token': access_token, 'refresh_token': refresh_token};
    /*let uri = process.env.FRONTEND_URI || 'http://localhost:7000'
    res.redirect(uri + '?access_token=' + access_token)*/
  //})

  // från nytt anrop
  /*token_requests[code] = access_token;
  console.log(token_requests)*/

  /*return res.status(200).send({
    status: 'ok'
  })*/
});

io.listen(SOCKET_PORT);

io.on('connection', (client) => {
  // here you can start emitting events to the client 
  var socketInterval;

  client.on('subscribeToCode', (code) => {

    console.log('client is subscribing to code ', code);

    socketInterval = setInterval(() => {
      console.log('socket connection')
      console.log('token_requests', token_requests)
      if (token_requests[code]) {

        console.log('token valid')
        clearInterval(socketInterval);
        var authData = token_requests[code];
        delete token_requests[code]; 
        client.emit('authData', authData);

      } else {
        console.log('no valid token found')
      }
    }, 1000);

  });
});