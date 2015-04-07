// onshape.js
// onshape interface module

var request = require('request');
var qhttp = require('q-io/http');

// EXPORTS

//  exports.onshapeProxyCall = onshapeProxyCall
//  exports.getSessionById = function(id)
//  exports.readContent = function(session)
//  exports.registerHook = function(session)
//  exports.webhookHandler = function(req, res)
//  exports.deleteHooks = function(session)
//  exports.setProtocol = function(proto)
//  exports.checkLogin = function(req, res)





// global variables
//
var allUserSessions = {};
var theProtocol = "";

// Return a GUID.
// As long as Math.random isn't re-seeded, this
// should be a reasonable proxy for a real GUID.
//
function getGUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
    return v.toString(16);
  })
}

// define a user session class
//
var userSession = function() {
  this.ID = getGUID();      // unique token for this session
  this.server = "";         // Onshape server to handle requests
  this.params = {};         // login params include docId, eltId, wsId
  this.cookie = "";         // borrowed cookie for easy auth - change when we support OAuth
  this.isLoggedIn = false;  // until authentication confirmed
  this.userEmail = "";      // user email for authenticated session
  this.host = "";           // hostname

  allUserSessions[this.ID] = this; // add self to map of all sessions
}

// define an Onshape proxy call class
//
var onshapeProxyCall = function(sessionID) {
  this.session = allUserSessions[sessionID];  // User session
  this.method = "";        // HTTP(S) method (eg GET)
  this.url = "";           // URL to call (eg /api/user)
  this.query = "";         // Query params, if any
  this.body = "";          // Body of request, if any
}

// call Onshape in context of requested session
// returns a promise for the response object
//
// TODO: check error return handling
//
onshapeProxyCall.prototype.callOnshapeInternal = function(theUrl) {
  var self = this;

//  console.log('OScall: ' + this.method + ' ' + url + ' body: <' + this.body + '>');
  console.log('OScall: ' + this.method + ' ' + theUrl );

  var options = {
    pool: false,
    url: theUrl,
    method: this.method,
    body: [this.body],
    headers: {
            'Cookie' : this.session.cookie,
            'User-Agent' : 'Nodejs Server',
            'Content-Type' : 'application/json'
          }
  };

  var ret = qhttp.request(options)
            .then( function(resp) {
//              console.log('check cookie');
              if ( (resp.status === 200) && (resp.headers['set-cookie']) ) {
//                console.log('setting cookie');
                self.session.cookie = resp.headers['set-cookie'];
              }
              // handle redirects
              if (resp.status === 307) {
                return self.callOnshapeInternal(resp.headers['location']);
              }

              return resp;
            });

  // return the promise for response
  return ret;
}


// Call Onshape
onshapeProxyCall.prototype.callOnshape = function() {
  var url = this.session.server + this.url;
  if (this.query) url += this.query;
  
// console.log('callI ' + url);

  return this.callOnshapeInternal(url);
}

// Redirect a call
onshapeProxyCall.prototype.redirect = function(newUrl) {
  return this.callOnshapeInternal(newUrl);
}

// define external interface

exports.userSession = userSession;
exports.onshapeProxyCall = onshapeProxyCall;


// Get a session object based on ID
//
exports.getSessionById = function(id) {
  return(allUserSessions[id]);
}


// register a hook to wake up on changes to our app element
//
exports.registerHook = function(sessionID) {
  // construct the hook request
  session = allUserSessions[sessionID];
  var hookBody = {};
  hookBody.url = theProtocol + '://' + session.host + '/webhook';
  hookBody.events = ['onshape.model.lifecycle.changed'];
  hookBody.filter = "{$DocumentId} = '" + session.params.documentId + "'&&" +
                    "{$WorkspaceId} = '" + session.params.workspaceId + "'&&" +
                    "{$ElementId} = '" + session.params.elementId + "'";
  hookBody.data = session.ID; 
  hookBody.options = {"collapseEvents" : true};

  var oscall = new onshapeProxyCall(sessionID);
  oscall.method = 'POST';
  oscall.url = '/api/webhooks';
  oscall.body = JSON.stringify(hookBody);

  oscall.callOnshape()
      .then( function()       {console.log('hook reg ok');} )
      .catch( function(error) {console.log('hook reg err= ' + error);} )
      .done();
}

exports.webhookHandler = function(req, res) {
  console.log("webhook with body " + JSON.stringify(req.body) );

  if (req.body.event == "webhook.register") {
    console.log("webhook register");

  } else if (req.body.event == "webhook.ping") {
    console.log("webhook ping ok");

  } else if (req.body.event == "webhook.unregister") {
    console.log("webhook unregister ok");

  } else if (req.body.event == "onshape.model.lifecycle.changed") {
    console.log('webhook change event');
    var session = exports.getSessionById(req.body.data);
    if (!session) {
      res.status(404);
      res.send('session not found');
      return;
    }
//  call update handler


  } else {
    res.status(404);
    res.send('unrecognized event');
    return;
  }

  res.status(200);
  res.send('ok');
  
}

// Todo: delete webhooks
//
exports.deleteHooks = function(sessionID) {

}

// Set http or https, depending on how we were run
//
exports.setProtocol = function(proto) {
  theProtocol = proto;
}

// checkLogin
//   This code uses a shared cookie.
//   Note that this only works for applications running in the
//   onshape.com domain. 
//
//   Generally, third-party applications should use OAuth to
//   authenticate.  However, at this time (Nov 2014) Onshape does not
//   yet support OAuth.  The alternative is to require the user to
//   enter a username and password, and send those using the login API.
//
exports.checkLogin = function(req, res) {
  console.log('check login to server ' + req.body.server);

  var theSession = new userSession();
  theSession.server = unescape(req.body.server);
  theSession.params = req.body;

//  console.log('cookies: ' + JSON.stringify(req.cookies));

  theSession.cookie = req.headers.cookie;
  theSession.host = req.headers.host;

  var oscall = new onshapeProxyCall(theSession.ID);
  oscall.method = 'GET';
  oscall.url = '/api/users/session';
  
  oscall.callOnshape()
      .then( function(resp) {
    
          if (resp.status != 200) {
            res.status(resp.status);
            res.send('Login failed');
            return;
          }

          console.log('check login ok');
          theSession.cookie = resp.headers['set-cookie'];
          theSession.isLoggedIn = true;

          resp.body.read()
              .then( function(buf) {

//console.log("login buf " + buf);
                var body = JSON.parse(buf);
                theSession.userEmail = body.email;
                var ret = {};
                ret.user = theSession.userEmail;
                ret.sessionID = theSession.ID;
                res.status(200);
                res.send(JSON.stringify(ret));
                })
              .catch( function(err) {
                console.log('check login read error ' + err);
                res.status(403);
                res.send('Login failed - read error');
                })
              .done();
        })

      .catch( function(err) {
          console.log('check login error ' + err)
          res.status(403);
          res.send('Login failed: ' + err);
          })

      .done();
}
