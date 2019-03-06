import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import querystring from 'querystring';
import cookieParser from 'cookie-parser';
import request from 'request';
import util from 'util';
import cron from 'node-cron';

const io = require('socket.io')();

require('dotenv').config();

var token_requests = {};

const fgOK = '\x1b[36m%s\x1b[0m';
const fgWarning = '\x1b[33m%s\x1b[0m';
const fgError = '\x1b[31m%s\x1b[0m';
const fgFunction = '\x1b[34m%s\x1b[0m';
const fgRequest = '\x1b[37m%s\x1b[0m';
const fgCron = '\x1b[35m%s\x1b[0m';

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

app.get('/', (req,res) => {
  console.log(' ')
  console.log(fgRequest, 'Request GET /')
  console.log(fgRequest, '-------------------------------------------------------------------------------------------------------------------')
  console.log(' ')

  //console.log(req.query.code) code from app

  if (req.query.access_token) {

    // Authorized
    console.log('authorized')

  } else if (req.query.code) {
    // code is present

    // check if code is valid
    if (token_requests[req.query.code]) {
      res.sendFile(path.join(__dirname+'/auth.html'));
    } else {
      // code is not valid
      return res.status(200).send({
        status: 'failed',
        message: 'code is not valid'
      });
    }
  } else {
    // code is not present, pls enter
    res.sendFile(path.join(__dirname+'/enter-code.html'));
  }

});

app.get('/login', (req, res) => {
  console.log(' ')
  console.log(fgRequest, 'Request GET /login')
  console.log(fgRequest, '-------------------------------------------------------------------------------------------------------------------')
  console.log(' ')

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

app.get('/callback', (req, res) => {
  console.log(' ')
  console.log(fgRequest, 'Request GET /callback')
  console.log(fgRequest, '-------------------------------------------------------------------------------------------------------------------')
  console.log(' ')
  
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

    // save createdAt to check if token is valid later
    var createdAt = Date.now();

    // store tokens in app
    // then send tokens to api when requesting data from spotify
    var swotifyCode = req.cookies.swotify_code;
    token_requests[swotifyCode] = {'access_token': access_token, 'refresh_token': refresh_token, 'createdAt': createdAt.toString()};

    return res.status(200).send({
      status: 'ok'
    });
  })

});

app.get('/api/v1/getUserData', async (req, res) => {
  console.log(' ')
  console.log(fgRequest, 'Request GET /getUserData')
  console.log(fgRequest, '-------------------------------------------------------------------------------------------------------------------')
  console.log(' ')

  // get access token, refresh token and datetime creaated
  //console.log(req.query)

  
  var createdAt = parseInt(req.query.createdAt);
  var timePassed = checkToken(createdAt);
  var newAuthData;

  // check if 1h passed since datetime created
  if (timePassed > 60) {
    // token has expired, request new
    var newTokenRequest = util.promisify(requestNewToken);
    newAuthData = await requestNewToken(req.query.refresh_token);
  } else {
    // token is valid
    newAuthData = {access_token: req.query.access_token}
  }

  // do request
  if (newAuthData) {
    let authOptions = {
      url: 'https://api.spotify.com/v1/me',
      headers: {
        'Authorization': 'Bearer ' + newAuthData.access_token
      }
    }

    request.get(authOptions, (error, response) =>  {
      var newResponse = JSON.parse(response.body)
      console.log(typeof newResponse)
      console.log(newResponse)
      console.log('newAuthData', newAuthData)
      return res.status(200).send({
        data: newResponse,
        newAuthData: newAuthData
      })
    })
  }

});

app.get('/api/v1/getPlayer', async (req, res) => {

})

io.listen(SOCKET_PORT);

io.on('connection', (client) => {
  console.log(' ')
  console.log(fgRequest, 'io socket -> on connection')
  console.log(fgRequest, '-------------------------------------------------------------------------------------------------------------------')
  console.log(' ')

  // here you can start emitting events to the client 

  client.on('subscribeToCode', (code) => {
    console.log(' ')
    console.log(fgRequest, 'io socket -> on connection -> subscribeToCode')
    console.log(fgRequest, '-------------------------------------------------------------------------------------------------------------------')
    console.log(' ')

    console.log('client is subscribing to code ', code);

    token_requests[code] = {};

    var socketInterval = setInterval(() => {
      console.log('socket connection')
      console.log('token_requests', token_requests)
      console.log('Object.keys(token_requests[code]).length', Object.keys(token_requests[code]).length)
      if (Object.keys(token_requests[code]).length) {

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

// empty code queue once a day at midnight
cron.schedule('0 0 * * *', () => {
  console.log(' ')
  console.log(fgCron, 'Running cron job')
  console.log(fgCron, '-------------------------------------------------------------------------------------------------------------------')
  console.log(' ')
  token_requests = {};
});

var checkToken = (createdAt) => {
  console.log(createdAt)
  var now = Date.now();

  var diff = now - createdAt;
  var timePassed = diff/60/1000;
  console.log('timePassed', timePassed)
  return timePassed;
}

var requestNewToken = async (refreshToken) => {
  let authOptions = {
    url: 'https://accounts.spotify.com/api/token',
    form: {
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    },
    headers: {
      'Authorization': 'Basic ' + (new Buffer.from(
        SPOTIFY_CLIENT_ID + ':' + SPOTIFY_CLIENT_SECRET
      ).toString('base64'))
    },
    json: true
  }

  var tokenRequest = util.promisify(request.post);
  var newToken = await tokenRequest(authOptions).catch((err) => {throw err});
  var createdAt = Date.now();

  if (newToken) {
    return {access_token: newToken.body['access_token'], createdAt: createdAt.toString()};
  }

}

/**
 * Generates a random string containing numbers and letters
 * @param  {number} length The length of the string
 * @return {string} The generated string
 */
var generateRandomString = (length) => {
  var text = '';
  var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

  for (var i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
};