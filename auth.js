// Authetication Services


// Google Sign In Module
const {OAuth2Client} = require('google-auth-library');
function create_gsignin(CLIENT_ID){
  // Create Google Sign In Verifacation Function
  const client = new OAuth2Client(CLIENT_ID);
  async function verify(token, CLIENT_ID) {
    // console.log(CLIENT_ID)
    const ticket = await client.verifyIdToken({
        idToken: token,
        audience: CLIENT_ID  // Specify the CLIENT_ID of the app that accesses the backend
        // Or, if multiple clients access the backend:
        //[CLIENT_ID_1, CLIENT_ID_2, CLIENT_ID_3]
    });
    const payload = ticket.getPayload();
    const userid = payload['sub'];
    // If request specified a G Suite domain:
    //const domain = payload['hd'];
    console.log(payload);
    return payload;
  }
  return verify;
}
//verify().catch(console.error);
// Export functions
module.exports = {
  create_gsignin: create_gsignin
}