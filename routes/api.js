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

var getStl = function(req, res) {
  var url = 'https://partner.dev.onshape.com/api/documents/' + req.query.documentId + '/export/' + req.query.stlElementId +
      '?workspaceId=' + req.query.workspaceId +
      '&format=STL&mode=' + 'text'  +
      '&scale=1&units=inch';
  if (req.query.partId !== '') {
    url += '&partId=' + req.query.partId;
  }
  if (req.query.angleTolerance !== '' && req.query.chordTolerance !== '') {
    url += '&angleTolerance=' + req.query.angleTolerance +'&chordTolerance=' + req.query.chordTolerance;
  }

  request.get({
    uri: url,
    headers: {
      'Authorization': 'Bearer ' + req.user.accessToken
    }
  }).then(function(data) {
    res.send(data);
  }).catch(function(data) {
    if (data.statusCode === 401) {
      authentication.refreshOAuthToken(req, res).then(function() {
        getStl(req, res);
      }).catch(function(err) {
        console.log('Error refreshing token or exporting stl data: ', err);
      });
    } else {
      console.log('GET /api/export error: ', data);
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


module.exports = router;
