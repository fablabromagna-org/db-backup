
const fs = require('fs');
const readline = require('readline');
const {google} = require('googleapis');
const mysqldump = require('mysqldump')

const SCOPES = ['https://www.googleapis.com/auth/drive'];
const TOKEN_PATH = 'token.json';

fs.readFile('credentials.json', (err, content) => {
  if (err) return console.log('Error loading client secret file:', err);

  authorize(JSON.parse(content), upload);
});

function authorize(credentials, callback) {
  const {client_secret, client_id, redirect_uris} = credentials.installed;
  const oAuth2Client = new google.auth.OAuth2(
      client_id, client_secret, redirect_uris[0]);

  fs.readFile(TOKEN_PATH, (err, token) => {
    if (err) return getAccessToken(oAuth2Client, callback);
    oAuth2Client.setCredentials(JSON.parse(token));
    upload(oAuth2Client);
  });
}

function getAccessToken(oAuth2Client, callback) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });
  console.log('Authorize this app by visiting this url:', authUrl);
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  rl.question('Enter the code from that page here: ', (code) => {
    rl.close();
    oAuth2Client.getToken(code, (err, token) => {
      if (err) return console.error('Error retrieving access token', err);
      oAuth2Client.setCredentials(token);

      fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
        if (err) console.error(err);
        console.log('Token stored to', TOKEN_PATH);
      });
      upload(oAuth2Client);
    });
  });
}

function upload(auth) {
 const drive = google.drive({version: 'v3', auth});

 mysqldump({
    connection: {
      host: process.env.MYSQL_HOST
      ,user: process.env.MYSQL_USER
      ,password: process.env.MYSQL_PWD
      ,database: process.env.MYSQL_DB
      ,charset: process.env.MYSQL_CHARSET
    }
    ,dumpToFile: './' + fileBackup
  }).then(() => {

  var fileMetadata = {
    'name': fileBackup,
    parents: [ PARENT_DIR ]
  };
  var media = {
    mimeType: 'application/sql',
    body: fs.createReadStream('./' + fileBackup)
  };
  drive.files.create({
    resource: fileMetadata,
    media: media,
    fields: 'id'
  }, function (err, file) {
    if (err) {
      // Handle error
      console.error(err);
    } else {
      console.log('File Id: ', file.id);
    }
  })
  });
}

var fileBackup =  'dump-' + Date.now() + '.sql'
