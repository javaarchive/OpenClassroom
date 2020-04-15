// Client side code
const signindelay = 1000;

if (!NProgress) {
  var NProgress = false; // STOP THAT LINTING ERROR
}
const loggedin = $("#loginstatus").val() == "loggedin";
console.log("Loading client-side code");
if (window.location.pathname == "/") {
  $("#home-item").addClass("active");
}
if (window.location.pathname == "/classrooms") {
  $("#classrooms-item").addClass("active");
}
function onSignIn(googleUser) {
  var id_token = googleUser.getAuthResponse().id_token;
  var profile = googleUser.getBasicProfile();
  $(".signin-text").html("Hello " + profile.getName());
  $("#loading").toggleClass("active");
  NProgress.start();
  setTimeout(function() {
    // console.log(id_token);
    var xhr = new XMLHttpRequest();
    xhr.open("POST", "/auth");
    xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
    xhr.onload = function() {
      NProgress.done();
      $("#loading").toggleClass("active");
      if(xhr.responseText == "Ok!"){
        window.location.href = "/app";
         }else{
        $(".signin-text").html(xhr.responseText);
        setTimeout(signOut,5000);
      }
    };
    xhr.send("type=google&idtoken=" + id_token);
  }, signindelay);
}
if (!gapi) {
  var gapi = false;
}

$(function(){
  gapi.load('auth2', function() {
        gapi.auth2.init();
      });
  
})
function signOut() {
  NProgress.start();
  var auth2 = gapi.auth2.getAuthInstance();
  // Deprecated Legacy no ajax version
  //$("#signoutform").submit();
  auth2.signOut().then(function() {
    NProgress.set(0.5);
    var xhr = new XMLHttpRequest();
    xhr.open("POST", "/signout");
    xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
    xhr.onload = function() {
      NProgress.done();
      window.location.href = "/";
    };
    xhr.send("confirm=yes");
    console.log("User signed out.");
  });
}
if(loggedin){
   $("#signin-signout").html("Logged in").click(signOut);
}else{
  $("#signin-signout").html("Logged out").click(function(e){window.location.href="/signin"})
}