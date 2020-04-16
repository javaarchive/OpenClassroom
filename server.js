// server.js
// where your node app starts

// we've started you off with Express (https://expressjs.com/)
// but feel free to use whatever libraries or frameworks you'd like through `package.json`.
const express = require("express");
const app = express();
const path = require("path");
var session = require("express-session");
const exphbs = require("express-handlebars");
const config = require("./config");
var auth = require("./auth");
var brand = "Auto?";
app.engine(".html", exphbs({ extname: ".html" }));
app.set("view engine", ".html");
app.set("views", path.join(__dirname, "/public"));
// Init Database
const Endb = require("endb");
const userdb = new Endb({ namespace: "users", uri: config.database });
const miscdb = new Endb({ namespace: "misc", uri: config.database });
async function initDB() {
  if (!(await miscdb.has("teachers"))) {
    await miscdb.set("teachers", []);
  }
}
initDB()
  .then(console.log)
  .catch(console.error);
// Extras
// app.enable('view cache');
// our nonexistent default array of dreams
// I destoryed the template yes

// make all the files in 'public' available
// https://expressjs.com/en/starter/static-files.html

// https://expressjs.com/en/starter/basic-routing.html
//app.get("/", (request, response) => {
//response.sendFile(__dirname + "/views/index.html");
//});
// Fetch store
var SQLiteStore = require("connect-sqlite3")(session);
app.use(
  session({
    store: new SQLiteStore(),
    secret: process.env.SECRET,
    cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 },
    resave: true,
    saveUninitialized: false
  })
);
// Body Parser
var bodyParser = require("body-parser");
app.use(bodyParser.json()); // support json encoded bodies
app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies
var http = require('http').createServer(app);
//var server = http.Server(app);
var io = require('socket.io')(http);
// Setup sessions for socketio
var ios = require('socket.io-express-session');
io.use(ios(session));
// Setup Auth
var googleAuth = auth.create_gsignin(process.env.GSIGNIN_CLIENT_ID);
// Response handlers
async function handler(req, res) {
  var templaterData = {};
  templaterData["brand"] = config["NAME"];
  templaterData["GSIGNIN_CLIENT_ID"] = process.env.GSIGNIN_CLIENT_ID;
  let isTeacher = false;
  var userdata = {}
  if (req.session.sessionid) {
    userdata = await userdb.get(req.session.sessionid);
    templaterData["loginstatus"] = "loggedin";
    isTeacher = (await miscdb.get("teachers")).includes(userdata["email"]) || (config.teachers.includes(userdata["email"]))
  } else {
    templaterData["loginstatus"] = "loggedout";
  }
  
  templaterData["teacher"] = isTeacher;
  if (req.originalUrl == "/") {
    res.render("index.html", templaterData);
  } else if (req.originalUrl == "/classrooms") {
    if (req.session.sessionid) {
      //console.log(req.session.sessionid)
      res.render("classrooms.html", templaterData);
    } else {
      res.render("signinprompt.html", templaterData);
    }
  } else if (req.originalUrl == "/signin") {
    if (!req.session.sessionid) {
      res.render("signin.html", templaterData);
    }
  } else if (req.originalUrl == "/auth") {
    if (req.body.type == "google") {
      var id = req.body.idtoken;
      // console.log(id);
      googleAuth(
        id,
        process.env.GSIGNIN_CLIENT_ID + ".apps.googleusercontent.com"
      )
        .then(async function(payload) {
          //res.send(JSON.stringify(payload));
          // Security
          let email_domain = payload["email"].substring(
            payload["email"].search("@") + 1
          );
          if (!payload["email_verified"] && config.require_verified_email) {
            res.send("You need a verified email for your google account");
          } else if (!config.trusted_domains.includes(email_domain) && !config.trust_all_domains) {
            res.send("Sorry your domain " + email_domain + " is not allowed");
          } else {
            let id = payload["sub"];
            req.session.sessionid = payload["sub"];
            if (!(await userdb.has(payload["sub"]))) {
              //userdb.set(payload["sub"], payload);
            }
            userdb.set(payload["sub"], payload);
            res.send("Ok!");
          }
        })
        .catch(console.log);
    }
  } else if (req.originalUrl == "/signout") {
    if (req.body.confirm == "yes") {
      //req.session.sessionid = false;
      req.session.destroy();
      res.send("Ok!");
    } else {
      res.send("No?");
    }
  } else if (req.originalUrl == "/app") {
    res.render("app.html", templaterData);
  } else if (req.originalUrl == "/api/user_data") {
    // let userdata = await userdb.get(req.session.sessionid);
    //console.log(userdata);
    res.send(JSON.stringify(userdata));
  } else if (req.originalUrl == "/api/client_data") {
    // let userdata = await userdb.get(req.session.sessionid);
    //console.log(userdata);
    let stripped_data = {
      full_name: userdata["name"],
      profile_pic: userdata["picture"]
    };
    res.send(JSON.stringify(stripped_data));
  }
}

app.get("/", handler);
app.get("/classrooms", handler);
app.get("/signin", handler);
app.post("/auth", handler);
app.post("/signout", handler);
app.get("/app", handler);
app.get("/api/user_data", handler);
app.get("/api/client_data", handler);
app.use(express.static("public"));
// Don't send the default array of dreams to the webpage
// Also removed from template
// listen for requests using http library instead:)
http.listen(3000, () => {
  console.log('listening on *:3000');
});
//const listener = app.listen(process.env.PORT, () => {
//  console.log("Your app is listening on port " + listener.address().port);
//});
