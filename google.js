const fs = require('fs')
const readline = require('readline')
const {google} = require('googleapis')
const mysqldump = require('mysqldump')
const os = require('os')

const SCOPES = ['https://www.googleapis.com/auth/drive', 'https://www.googleapis.com/auth/gmail.send']
const TOKEN_PATH = 'token.json'

fs.readFile('credentials.json', (err, content) => {
    if (err) return console.log('Error loading client secret file:', err)

    authorize(JSON.parse(content), upload)
})

function authorize (credentials, callback) {
    const {client_secret, client_id, redirect_uris} = credentials.installed
    const oAuth2Client = new google.auth.OAuth2(
        client_id, client_secret, redirect_uris[0])

    fs.readFile(TOKEN_PATH, (err, token) => {
        if (err) return getAccessToken(oAuth2Client, callback)
        oAuth2Client.setCredentials(JSON.parse(token))
        upload(oAuth2Client)
    })
}

function getAccessToken (oAuth2Client, callback) {
    const authUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
    })
    console.log('Authorize this app by visiting this url:', authUrl)
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    })
    rl.question('Enter the code from that page here: ', (code) => {
        rl.close()
        oAuth2Client.getToken(code, (err, token) => {
            if (err) return console.error('Error retrieving access token', err)
            oAuth2Client.setCredentials(token)

            fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
                if (err) console.error(err)
                console.log('Token stored to', TOKEN_PATH)
            })
            upload(oAuth2Client)
        })
    })
}

function upload (auth) {
    const drive = google.drive({version: 'v3', auth})

    mysqldump({
        connection: {
            host: process.env.MYSQL_HOST
            , user: process.env.MYSQL_USER
            , password: process.env.MYSQL_PWD
            , database: process.env.MYSQL_DB
            , charset: process.env.MYSQL_CHARSET
        }
        , dumpToFile: './' + fileBackup

    }).then(() => {

        var fileMetadata = {
            'name': fileBackup,
            parents: [process.env.PARENT_DIR]
        }

        var media = {
            mimeType: 'application/sql',
            body: fs.createReadStream('./' + fileBackup)
        }

        drive.files.create({
            resource: fileMetadata,
            media: media,
            fields: 'id'
        }, function (err, file) {
            if (err) {
                sendMessage(auth, '[ACTION REQUIRED] Backup failed on ' + os.hostname() + '!', 'Failed database backup on server (GDrive) ' + os.hostname() + '\r\nTime: ' + (new Date).toUTCString() + '\r\n' + 'Error: ' + err)
            } else {
                sendMessage(auth, 'Backup succeeded on ' + os.hostname() + '!', 'Completed database backup on server ' + os.hostname() + '\r\nTime: ' + (new Date).toUTCString()  + '\r\nFile name: ' + fileBackup)
            }
        })
    }).catch((err) => {
        sendMessage(auth, '[ACTION REQUIRED] Backup failed on ' + os.hostname() + '!', 'Failed database backup on server (dump) ' + os.hostname() + '\r\nTime: ' + (new Date).toUTCString() + '\r\n' + 'Error: ' + err)
    })
}

var fileBackup = 'dump-' + Date.now() + '.sql'

function makeBody (to, from, subject, message) {
    var str = ['Content-Type: text/plain; charset="UTF-8"\n',
        'MIME-Version: 1.0\n',
        'Content-Transfer-Encoding: 7bit\n',
        'to: ', to, '\n',
        'from: ', from, '\n',
        'subject: ', subject, '\n\n',
        message
    ].join('')

    return new Buffer(str).toString('base64').replace(/\+/g, '-').replace(/\//g, '_')
}

function sendMessage (auth, subject, body) {
    const gmail = google.gmail({version: 'v1', auth})

    var raw = makeBody(process.env.EMAIL, process.env.EMAIL, subject, body)

    gmail.users.messages.send({
        auth: auth,
        userId: 'me',
        resource: {
            raw: raw
        }
    }, function (err, response) {
        
    })
}

