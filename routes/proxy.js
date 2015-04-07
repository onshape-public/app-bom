var onshape = require('./onshape');

var registrations = {};

function callOnshape(res, theID, theMethod, theUrl, theQueryParams, theBody) {

  var oscall = new onshape.onshapeProxyCall(theID);
  oscall.method = theMethod;
  oscall.url = theUrl;
  if (theBody) {
    oscall.body = theBody;
  } else {
    oscall.body = "";
  }
  oscall.query = theQueryParams;

  oscall.callOnshape()
      .then( function(resp) {
          resp.body.read()
              .then( function(buf) {
//                console.log('callos rets ' + resp.status);
//                console.log('callos body ' + '<' + buf + '>');
                res.status(resp.status);
                res.send(buf);
          })
  })
      .catch( function(err) {
          console.log('callos err ' + err);
          res.status(404);
          res.body(err);
  });
}


exports.proxy = function(req, res) {

//  console.log('proxy call id ' + req.body.sessionID + ' ' + req.body.name);
  if (req.body.name != 'generic') {
    res.status(400);
    return;
  }

  callOnshape(res, req.body.sessionID, req.body.method, req.body.path, req.body.params, req.body.body);
}



exports.notifyInfo = function(req, res) {

  var url = req.url;
  var regex = /\/notifyInfo\/([a-zA-Z0-9]+)/;
  var webhookId = regex.exec(url)[1];
  console.log('got notify info request for: ', webhookId);

  var webhookInfo = registrations[webhookId];
  if (webhookInfo) {
    res.send(JSON.stringify(webhookInfo, null, 2));
  } else {
    res.status(400);
    res.send("not found");
  }
}


exports.notify = function(req, res) {

  console.log('got notify');
  console.log(req.body);

  if (req.body.event == "webhook.register") {
    registrations[req.body.webhookId] = { 'lastNotification' : req.body,
                                          'notificationCount' : 1
                                        };
    console.log("register succeeded for webhook " + req.body.webhookId);
    res.send("ok");
  } else if (req.body.event == "webhook.unregister") {
    delete registrations[req.body.webhookId];
    console.log("unregister succeeded for webhook " + req.body.webhookId);
    res.send("ok");
  } else if (!registrations[req.body.webhookId]) {
    console.log("unwanted notification for webhook " + req.body.webhookId);
    res.status(400);
    res.send("not registered");
  } else {
    console.log("received notification of event " + req.body.event + " for " + req.body.webhookId);
    registrations[req.body.webhookId].lastNotification = req.body;
    registrations[req.body.webhookId].notificationCount += 1;
    res.send("ok");
  }
}
