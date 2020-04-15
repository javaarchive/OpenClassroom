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
// Extras
// app.enable('view cache');
// our nonexistent default array of dreams
// I killed the template yes

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
// Setup Auth
var googleAuth = auth.create_gsignin(process.env.GSIGNIN_CLIENT_ID);
// Response handlers
async function handler(req, res) {
  var templaterData = {};
  templaterData["brand"] = config["NAME"];
  templaterData["GSIGNIN_CLIENT_ID"] = process.env.GSIGNIN_CLIENT_ID;
  if (req.session.sessionid) {
    templaterData["loginstatus"] = "loggedin";
  } else {
    templaterData["loginstatus"] = "loggedout";
  }
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
        .then(function(payload) {
          //res.send(JSON.stringify(payload));
          // Security
          let email_domain = payload["email"].substring(
            payload["email"].search("@") + 1
          );
          if (!payload["email_verified"] && config.require_verified_email) {
            res.send("You need a verified email for your google account");
          } else if (!config.trusted_domains.includes(email_domain)) {
            res.send("Sorry your domain " + email_domain + " is not allowed");
          } else {
            req.session.sessionid = payload["sub"];
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
  }
}

app.get("/", handler);
app.get("/classrooms", handler);
app.get("/signin", handler);
app.post("/auth", handler);
app.post("/signout", handler);
app.use(express.static("public"));
// Don't send the default array of dreams to the webpage
// Also removed from template
// listen for requests :)
const listener = app.listen(process.env.PORT, () => {
  console.log("Your app is listening on port " + listener.address().port);
});
