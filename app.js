
    
import express from 'express'
import bodyParser from 'body-parser'

require('dotenv').config();

const app = express();
const PORT = process.env.PORT;
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const SPOTIFY_REDIRECT_URL = process.env.SPOTIFY_REDIRECT_URL;

app.listen(PORT, () => {
  console.log(`server running on port ${PORT}`)
});

app.use(bodyParser.urlencoded({ extended: true }))
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*")
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept")
  next()
})
app.use(bodyParser.json());