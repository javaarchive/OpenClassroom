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
const classroommetadb = new Endb({ namespace: "meta", uri: config.database });
const classroomchatdb = new Endb({ namespace: "chat", uri: config.database });
async function initDB() {
  if (!(await miscdb.has("teachers"))) {
    await miscdb.set("teachers", []);
  }
}
initDB()
  .then(console.log)
  .catch(console.error);
// Security
const bcrypt = require('bcrypt');
const saltRounds = config.salt_rounds;


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
// Fetch store and init sessions
var SQLiteStore = require("connect-sqlite3")(session);
let sess = session({
    store: new SQLiteStore(),
    secret: process.env.SECRET,
    cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 },
    resave: true,
    saveUninitialized: false
  });
app.use(
  sess
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
io.use(ios(sess));
// Setup Auth
var googleAuth = auth.create_gsignin(process.env.GSIGNIN_CLIENT_ID);
// Create Classroom
var creationSubscriber = {} // Temporary because classrooms should be created without server restarts
async function inform(name, text){
  if(Object.keys(creationSubscriber).includes(name)){
    let subscribers = creationSubscriber[name];
     for(var i =0 ; i < subscribers.length; i ++){
       subscribers[i].emit("creation_event",{status:"Ok!",text:text})
     }
     }
}
async function finish(name){
  if(Object.keys(creationSubscriber).includes(name)){
    let subscribers = creationSubscriber[name];
     for(var i =0 ; i < subscribers.length; i ++){
       subscribers[i].emit("creation_event",{status:"Finish",text:"Done!"})
     }
     }
}
async function createClassroom(owner, name, password){
  if(password == ""){
    password = "1234"; // Same as no password pretty much but we wanna use our hashing system
  }
  bcrypt.genSalt(saltRounds, function(err, salt) {
    bcrypt.hash(password, salt, async function(err, hash) {
        inform(name, "Saving password to temporary data store");
      var classData = {password_hash: hash}
      inform(name, "Creating Classroom");
      classData["name"] = name;
      classData["owner"] = owner;
      await classroommetadb.set(name, classData);
      inform(name, "Init Chat");
      var emptyChat = {messages: [], online: [], conversations: []};
      inform(name, "Saving...");
      await classroomchatdb.set(name, emptyChat);
      finish(name);
    });
});
}



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
              //userdb                                 //userdb.set(payload["sub"], payload);
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
    if(req.session.sessionid){
      res.render("app.html", templaterData);
    }else{
      res.render("signinprompt.html", templaterData);
    }
  } else if (req.originalUrl == "/api/user_data") {
    if(!req.session.sessionid){
       res.render("signinprompt.html", templaterData);
      return;
       }
    // let userdata = await userdb.get(req.session.sessionid);
    //console.log(userdata);
    res.send(JSON.stringify(userdata));
  } else if (req.originalUrl == "/api/client_data") {
    if(!req.session.sessionid){
       res.render("signinprompt.html", templaterData);
      return;
       }
    // let userdata = await userdb.get(req.session.sessionid);
    //console.log(userdata);
    let stripped_data = {
      full_name: userdata["name"],
      profile_pic: userdata["picture"]
    };
    res.send(JSON.stringify(stripped_data));
  }else if(req.originalUrl == "/create_classroom" && isTeacher){
    if(!req.session.sessionid){
       res.render("signinprompt.html", templaterData);
      return;
       }
    templaterData["classroom_name"] = req.body["classroom-name"];
    if(!(await classroommetadb.has(req.body["classroom-name"]))){
      creationSubscriber[req.body["classroom-name"]] = [];
      setTimeout(createClassroom, config.load_delay, req.session.sessionid, req.body["classroom-name"], req.body["password"]);
      res.render("classroomloading.html", templaterData);
  }else{
    res.send("Classroom already exists with that name")
  }
  }
  if(req.originalUrl.startsWith("/classroom")){
    let classroom_name = req.params["className"];
     templaterData["classroom_name"] = classroom_name;
    if(await classroommetadb.has(classroom_name)){
      if(!req.session.sessionid){
       res.render("signinprompt.html", templaterData);
      return;
       }
      res.render("classroomview.html",templaterData);
  }else{
    if(!req.session.sessionid){
       res.render("signinprompt.html", templaterData);
      return;
       }
    res.render("notfound.html",templaterData);
  }
  }
}
// Naming utils
function dataToUniqueName(data){
  return data["email"].substring(0,data["email"].search("@"));
}
// Bindings
app.get("/", handler);
app.get("/classrooms", handler);
app.get("/signin", handler);
app.post("/auth", handler);
app.post("/signout", handler);
app.get("/app", handler);
app.get("/api/user_data", handler);
app.get("/api/client_data", handler);
// Classroom Bindings
app.post("/create_classroom", handler);
app.use(express.static("public"));
app.get('/classroom/:className', handler)

// Socket Handlers


console.log("Set socket handlers")
io.on('connection', async function (socket) {
  console.log("Socket got connection");
  socket.emit('start', { status: "Ok!" });
  socket.on('start', function (data) {
    console.log("hello from "+data);
  });
  socket.on('report', function (data) {
    console.log(data);
  });
  socket.on("enterclassroom",async function(data){
    //console.log(socket.handshake.session)
    try{
    let classroomName = data["classroom"];
    let sessionid = socket.handshake.session.sessionid;
      let userdata = await userdb.get(sessionid);
      let name = dataToUniqueName(userdata);
      console.log(name+" joined the classroom");
      let visibleData = {id: sessionid, display: name}
      let classroom = await classroomchatdb.get(classroomName);
      classroom["online"].push(visibleData);
      classroom["messages"].push({author: "System", content: name+" has joined"});
      await classroomchatdb.set(classroomName,classroom);
      console.log("DB Saved");
    socket.on('disconnect', async function () {
      console.log(name+" disconnected")
      let classroom = await classroomchatdb.get(classroomName);
      classroom["online"].filter(item => item !== visibleData);
      classroom["messages"].push({author: "System", content: name+" has left"});
      await classroomchatdb.set(classroomName,classroom);
      
    });
    }catch(ex){
      console.log("Error occured")
      console.log(ex);
      socket.emit("fail", {"info":ex.toString()});
    }
  });
  socket.on("request_classroom_data",async function(data){
    let classroomName = data["classroom"];
    let sessionid = socket.handshake.session.sessionid;
    let userdata = await userdb.get(sessionid);
      let name = dataToUniqueName(userdata);
    console.log(name+" requested classroom data");
    let classdata = (await classroomchatdb.get(classroomName));
    if(classdata["online"].includes({id: socket.handshake.session.sessionid, display: sessionid})){
        classdata["online"] = classdata["online"].map(function(person){delete person["id"]});
      if(Object.keys(data).includes("part")){
        socket.emit("classroom_"+data["part"],classdata[data["part"]]); // Optional Part Selection to save bandwith
      }else{
        console.log("Sent data to "+name);
      socket.emit("classroom",classdata); 
      }
    }else{
      console.log("Rejected data request because user is not in classroom")
    }
  })
  socket.on("creation_subscribe",function (data) {
    socket.emit("creation_event",{status:"Ok!",text:"Creating Classroom"});
    creationSubscriber[data["name"]].push(socket);
  })
});


// Don't send the default array of dreams to the webpage
// Also removed from template
// listen for requests using http library instead:)
http.listen(process.env.PORT, () => {
  console.log('listening on *:3000');
});
//const listener = app.listen(process.env.PORT, () => {
//  console.log("Your app is listening on port " + listener.address().port);
//});
