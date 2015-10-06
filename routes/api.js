var express = require('express');
var router = express.Router();
var authentication = require('../authentication');
var request = require('request-promise');
var url = require('url');

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

router.post('/logout', function(req, res) {
  req.session.destroy();
  return res.send({});
});

var getSession = function(req, res) {
  request.get({
    uri: 'https://partner.dev.onshape.com/api/users/session',
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
    uri: 'https://partner.dev.onshape.com/api/documents',
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
  var url = 'https://partner.dev.onshape.com/api/documents/d/' + req.query.documentId + '/w/' + req.query.workspaceId + '/elements';
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
  var url = 'https://partner.dev.onshape.com/api/documents/d/' + req.query.documentId + '/w/' + req.query.workspaceId + '/elements?elementType=assembly';
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
    uri: 'https://partner.dev.onshape.com/api/assemblies/d/' + req.query.documentId +
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
    uri: 'https://partner.dev.onshape.com/api/assemblies/d/' + req.query.documentId +
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
    uri: 'https://partner.dev.onshape.com/api/parts/d/' + req.query.documentId + '/w/' + req.query.workspaceId,
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
    uri: 'https://partner.dev.onshape.com/api/assemblies/d/' + req.query.documentId + '/w/' + req.query.workspaceId + '/e/' + req.query.nextElement + '?includeMateFeatures=false',
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
    uri: 'https://partner.dev.onshape.com/api/parts/d/' + req.query.documentId + '/w/' + req.query.workspaceId + '/e/' + req.query.elementId + '/partid/' + req.query.partId + '/metadata',
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

var setWebhooks = function(req, res) {
  var eventList = [ "onshape.model.lifecycle.changed" ];
  var options = { collapseEvents : true };
  var urlNotify = "https://onshape-appstore-bom.herokuapp.com/notify";
  var filter = "{$DocumentId} = '" + req.query.documentId + "' && " +
               "{$WorkspaceId} = '" + req.query.workspaceId + "' && " +
               "{$ElementId} = '" + req.query.elementId + "'";

  request.post({
    uri: 'https://partner.dev.onshape.com/api/webhooks/',
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

router.get('/documents', getDocuments);
router.get('/session', getSession);
router.get('/elements', getElementList);
router.get('/assemblies', getAssemblyList);
router.get('/parts', getPartsList);
router.get('/boundingBox', getBoundingBox);
router.get('/definition', getAssemblyDefinition);
router.get('/shadedView', getShadedView);
router.get('/metadata', getMetadata);
router.get('/webhooks', setWebhooks);

module.exports = router;
