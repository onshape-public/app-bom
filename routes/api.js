var express = require('express');
var session = require('express-session');
var redis = require('redis');

var router = express.Router();
var authentication = require('../authentication');
var request = require('request-promise');
var url = require('url');

var  apiUrl = 'https://cad.onshape.com';
if (process.env.API_URL) {
  apiUrl = process.env.API_URL;
}

var client;
if (process.env.REDISTOGO_URL) {
  var rtg   = require("url").parse(process.env.REDISTOGO_URL);
  client = require("redis").createClient(rtg.port, rtg.hostname);

  client.auth(rtg.auth.split(":")[1]);
} else if (process.env.REDIS_HOST && process.env.REDIS_PORT) {
  client = require("redis").createClient(process.env.REDIS_PORT, process.env.REDIS_HOST);
} else {
  client = redis.createClient();
}

// Simple route middleware to ensure user is authenticated.
//   Use this route middleware on any resource that needs to be protected.  If
//   the request is authenticated (typically via a persistent login session),
//   the request will proceed.  Otherwise, the user will be redirected to the
//   login page.
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next()
  }
  res.status(401).send({
    authUri: authentication.getAuthUri(),
    msg: 'Authentication required.'
  });
}

router.sendNotify = function(req, res) {
  if (req.body.event == 'onshape.model.lifecycle.changed') {
    var state = {
      elementId : req.body.elementId,
      change : true
    };

    var stateString = JSON.stringify(state);
    var uniqueID = "change" + req.body.elementId;
    client.set(uniqueID, stateString);
  }

  res.send("ok");
}

router.post('/logout', function(req, res) {
  req.session.destroy();
  return res.send({});
});

var getSession = function(req, res) {
  request.get({
    uri: apiUrl + '/api/users/sessioninfo',
    headers: {
      'Authorization': 'Bearer ' + req.user.accessToken
    }
  }).then(function(data) {
    res.send(data);
  }).catch(function(data) {
    console.log('****** getSession - CATCH ' + data.statusCode);
    if (data.statusCode === 401) {
      authentication.refreshOAuthToken(req, res).then(function() {
        getSession(req, res);
      }).catch(function(err) {
        console.log('Error refreshing token or getting session: ', err);
      });
    } else {
      console.log('GET /api/users/session error: ', data);
    }
  });
};

var getDocuments = function(req, res) {
  request.get({
    uri: apiUrl + '/api/documents',
    headers: {
      'Authorization': 'Bearer ' + req.user.accessToken
    }
  }).then(function(data) {
    res.send(data);
  }).catch(function(data) {
    if (data.statusCode === 401) {
      authentication.refreshOAuthToken(req, res).then(function() {
        getDocuments(req, res);
      }).catch(function(err) {
        console.log('Error refreshing token or getting documents: ', err);
      });
    } else {
      console.log('GET /api/documents error: ', data);
    }
  });
};

var getElementList = function(req, res) {
  var url = apiUrl + '/api/documents/d/' + req.query.documentId + '/w/' + req.query.workspaceId + '/elements';
  if (req.query.elementId) {
    url += '/?elementId=' + req.query.elementId;
  }

  request.get({
    uri: url,
    headers: {
      'Authorization': 'Bearer ' + req.user.accessToken
    }
  }).then(function(data) {
    res.send(data);
  }).catch(function(data) {
    console.log('****** getElementList - CATCH ' + data.statusCode);
    if (data.statusCode === 401) {
      authentication.refreshOAuthToken(req, res).then(function() {
        getElementList(req, res);
      }).catch(function(err) {
        console.log('Error refreshing token or getting elements: ', err);
      });
    } else {
      console.log('GET /api/documents/elements error: ', data);
    }
  });
};

var getAssemblyList = function(req, res) {
  var url = apiUrl + '/api/documents/d/' + req.query.documentId + '/w/' + req.query.workspaceId + '/elements?elementType=assembly';
  if (req.query.elementId) {
    url += '/?elementId=' + req.query.elementId;
  }

  request.get({
    uri: url,
    headers: {
           'Authorization': 'Bearer ' + req.user.accessToken
         }
  }).then(function(data) {
    res.send(data);
  }).catch(function(data) {
    console.log('****** getAssemblyList - CATCH ' + data.statusCode);
    if (data.statusCode === 401) {
      authentication.refreshOAuthToken(req, res).then(function() {
        getElementList(req, res);
      }).catch(function(err) {
        console.log('Error refreshing token or getting elements: ', err);
      });
    } else {
      console.log('GET /api/documents/elements ?type=assembly error: ', data);
    }
  });
};


var getShadedView = function(req, res) {
  request.get({
    uri: apiUrl + '/api/assemblies/d/' + req.query.documentId +
    '/w/' + req.query.workspaceId + '/e/' + req.query.elementId + '/shadedviews?' +
    '&outputHeight=' + req.query.outputHeight + '&outputWidth=' + req.query.outputWidth + '&pixelSize=' + req.query.pixelSize +
    '&viewMatrix=' + req.query.viewMatrix1 + ',' + req.query.viewMatrix2 + ',' + req.query.viewMatrix3 + ',' + req.query.viewMatrix4 +
    ',' + req.query.viewMatrix5 + ',' + req.query.viewMatrix6 + ',' + req.query.viewMatrix7 + ',' + req.query.viewMatrix8 +
    ',' + req.query.viewMatrix9 + ',' + req.query.viewMatrix10 + ',' + req.query.viewMatrix11 + ',' + req.query.viewMatrix12 +
    '&perspective=false',
    headers: {
      'Authorization': 'Bearer ' + req.user.accessToken
    }
  }).then(function(data) {

    res.send(data);
  }).catch(function(data) {
    if (data.statusCode === 401) {
      authentication.refreshOAuthToken(req, res).then(function() {
        getShadedView(req, res);
      }).catch(function(err) {
        console.log('Error refreshing token or getting shaded view: ', err);
      });
    } else {
      console.log('GET /api/assemblies/shadedviews error: ', data);
    }
  });
};

var getBoundingBox = function(req, res) {
  request.get({
    uri: apiUrl + '/api/assemblies/d/' + req.query.documentId +
          '/w/' + req.query.workspaceId + '/e/' + req.query.elementId + '/boundingboxes/',
    headers: {
      'Authorization': 'Bearer ' + req.user.accessToken
    }
  }).then(function(data) {
    res.send(data);
  }).catch(function(data) {
    if (data.statusCode === 401) {
      authentication.refreshOAuthToken(req, res).then(function() {
        getBoundingBox(req, res);
      }).catch(function(err) {
        console.log('Error refreshing token or getting bounding box: ', err);
      });
    } else {
      console.log('GET /api/assemblies/boundingbox error: ', data);
    }
  });
};

var getPartsList = function(req, res) {
  request.get({
    uri: apiUrl + '/api/parts/d/' + req.query.documentId + '/w/' + req.query.workspaceId,
    headers: {
      'Authorization': 'Bearer ' + req.user.accessToken
    }
  }).then(function(data) {
    res.send(data);
  }).catch(function(data) {
    if (data.statusCode === 401) {
      authentication.refreshOAuthToken(req, res).then(function() {
        getPartsList(req, res);
      }).catch(function(err) {
        console.log('Error refreshing token or getting parts: ', err);
      });
    } else {
      console.log('GET /api/parts/workspace error: ', data);
    }
  });
};

var getAssemblyDefinition = function(req, res) {
  request.get({
    uri: apiUrl + '/api/assemblies/d/' + req.query.documentId + '/w/' + req.query.workspaceId + '/e/' + req.query.nextElement + '?includeMateFeatures=false',
    headers: {
      'Authorization': 'Bearer ' + req.user.accessToken
    }
  }).then(function(data) {
    res.send(data);
  }).catch(function(data) {
    if (data.statusCode === 401) {
      authentication.refreshOAuthToken(req, res).then(function() {
        getAssemblyDefinition(req, res);
      }).catch(function(err) {
        console.log('Error refreshing token or getting assembly definition: ', err);
      });
    } else {
      console.log('GET /api/models/assembly/definition error: ', data);
    }
  });
};

var getMetadata = function(req, res) {
   request.get({
    uri:apiUrl + '/api/parts/d/' + req.query.documentId + '/w/' + req.query.workspaceId + '/e/' + req.query.elementId + '/partid/' + req.query.partId + '/metadata',
    headers: {
      'Authorization': 'Bearer ' + req.user.accessToken
    }
  }).then(function(data) {
    res.send(data);
  }).catch(function(data) {
    if (data.statusCode === 401) {
      authentication.refreshOAuthToken(req, res).then(function() {
        getMetadata(req, res);
      }).catch(function(err) {
        console.log('Error refreshing token or getting part metadata: ', err);
      });
    } else {
      console.log('GET /api/parts/metadata error: ', data);
    }
  });
};

var getStudioMetadata = function(req, res) {
  var url = '/api/partstudios/d/' + req.query.documentId + '/w/' + req.query.workspaceId + '/e/' + req.query.elementId + '/metadata';
  if (req.query.microversionId > 0)
    url = '/api/partstudios/d/' + req.query.documentId + '/m/' + req.query.microversionId + '/e/' + req.query.elementId + '/metadata'
  request.get({
    uri:apiUrl + '/api/partstudios/d/' + req.query.documentId + '/w/' + req.query.workspaceId + '/e/' + req.query.elementId + '/metadata',
    headers: {
      'Authorization': 'Bearer ' + req.user.accessToken
    }
  }).then(function(data) {
    res.send(data);
  }).catch(function(data) {
    if (data.statusCode === 401) {
      authentication.refreshOAuthToken(req, res).then(function() {
        getMetadata(req, res);
      }).catch(function(err) {
        console.log('Error refreshing token or getting partstudio metadata: ', err);
      });
    } else {
      console.log('GET /api/partstudios/metadata error: ', data);
    }
  });
};

var getExternalStudioMetadata = function(req, res) {
  var url = '/api/partstudios/d/' + req.query.documentId + '/v/' + req.query.versionId + '/e/' + req.query.elementId + '/metadata?linkDocumentId=' + req.query.linkDocumentId;
  request.get({
    uri:apiUrl + url,
    headers: {
      'Authorization': 'Bearer ' + req.user.accessToken
    }
  }).then(function(data) {
    res.send(data);
  }).catch(function(data) {
    if (data.statusCode === 401) {
      authentication.refreshOAuthToken(req, res).then(function() {
        getMetadata(req, res);
      }).catch(function(err) {
        console.log('Error refreshing token or getting external partstudio metadata: ', err);
      });
    } else {
      console.log('GET /api/partstudios/metadata error: ', data);
    }
  });
};

var setWebhooks = function(req, res) {
  var eventList = [ "onshape.model.lifecycle.changed" ];
  var options = { collapseEvents : true };
  var urlNotify = "https://onshape-app-bom.herokuapp.com/notify";
  var filter = "{$DocumentId} = '" + req.query.documentId + "' && " +
               "{$WorkspaceId} = '" + req.query.workspaceId + "' && " +
               "{$ElementId} = '" + req.query.elementId + "'";

  request.post({
    uri: apiUrl + '/api/webhooks/',
    body: {
      url : urlNotify,
      events : eventList,
      filter : filter,
      options : options
    },
    headers: {
      'Authorization': 'Bearer ' + req.user.accessToken
    },
    json : true
  }).then(function(data) {
    res.send(data);
  }).catch(function(data) {
    if (data.statusCode === 401) {
      authentication.refreshOAuthToken(req, res).then(function() {
        setWebhooks(req, res);
      }).catch(function(err) {
        console.log('*** Error refreshing token or setting webhooks: ', err);
      });
    } else {
      console.log('*** POST /api/webhooks error: ', data);
    }
  });
};

var checkModelChange = function(req, res) {
  var data = {
    statusCode : 200,
    change : false
  };

  // Get the current setting from Redis (if there is one)
  var uniqueID = "change" + req.query.elementId;
  client.get(uniqueID, function(err, reply) {
    // reply is null when the key is missing
    if (reply != null) {
      var newParams = JSON.parse(reply);
      data.change = newParams.change;

      // Now that we have the value, clear it in Redis
      var state = {
        elementId : req.query.elementId,
        change : false
      };

      var stateString = JSON.stringify(state);
      client.set(uniqueID, stateString);
    }

    res.send(data);
  });
}

var getAccounts = function(req, res) {
  var url = apiUrl + '/api/accounts/purchases';

  request.get({
    uri: url,
    headers: {
      'Authorization': 'Bearer ' + req.user.accessToken
    }
  }).then(function(data) {
    var object = JSON.parse(data);

    // Walk through the various apps that the user has purchased looking for this one.
    var isSubscribed = false;
    for (var i = 0; i < object.length; ++i) {
      if (object[i].clientId == process.env.OAUTH_CLIENT_ID)
        isSubscribed = true;
    }

    var returnData = {
      Subscribed : isSubscribed,
      Items : object
    };

    res.send(returnData);
  }).catch(function(data) {
    console.log('****** getAccounts - CATCH ' + data.statusCode);
    if (data.statusCode === 401) {
      authentication.refreshOAuthToken(req, res).then(function() {
        getElementList(req, res);
      }).catch(function(err) {
        console.log('Error refreshing token or getting accounts: ', err);
      });
    } else {
      console.log('GET /api/accounts/purchases error: ', data);
    }
  });
};

var getWorkspace = function(req, res) {
  var url = apiUrl + '/api/documents/d/' + req.query.documentId + '/workspaces';

  request.get({
    uri: url,
    headers: {
      'Authorization': 'Bearer ' + req.user.accessToken
    }
  }).then(function(data) {
    res.send(data);
  }).catch(function(data) {
    console.log('****** getWorkspace - CATCH ' + data.statusCode);
    if (data.statusCode === 401) {
      authentication.refreshOAuthToken(req, res).then(function() {
        getElementList(req, res);
      }).catch(function(err) {
        console.log('Error refreshing token or getting workspace: ', err);
      });
    } else {
      console.log('GET /api/documents/workspaces error: ', data);
    }
  });
};

var getVersions = function(req, res) {
  var url = apiUrl + '/api/documents/d/' + req.query.documentId + '/versions';

  request.get({
    uri: url,
    headers: {
      'Authorization': 'Bearer ' + req.user.accessToken
    }
  }).then(function(data) {
    res.send(data);
  }).catch(function(data) {
    console.log('****** getVersions - CATCH ' + data.statusCode);
    if (data.statusCode === 401) {
      authentication.refreshOAuthToken(req, res).then(function() {
        getElementList(req, res);
      }).catch(function(err) {
        console.log('Error refreshing token or getting versions: ', err);
      });
    } else {
      console.log('GET /api/documents/versions error: ', data);
    }
  });
};

router.get('/documents', getDocuments);
router.get('/session', getSession);
router.get('/elements', getElementList);
router.get('/assemblies', getAssemblyList);
router.get('/parts', getPartsList);
router.get('/boundingBox', getBoundingBox);
router.get('/definition', getAssemblyDefinition);
router.get('/shadedView', getShadedView);
router.get('/metadata', getMetadata);
router.get('/studiometadata', getStudioMetadata);
router.get('/externalstudiometadata', getExternalStudioMetadata);
router.get('/webhooks', setWebhooks);
router.get('/modelchange', checkModelChange);
router.get('/accounts', getAccounts);
router.get('/workspace', getWorkspace);
router.get('/versions', getVersions);

module.exports = router;
