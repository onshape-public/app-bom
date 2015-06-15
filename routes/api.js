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

router.get('/session', function(req, res) {
  if (req.user) {
    res.send({userId: req.user.id});
  } else {
    res.status(401).send({
      authUri: authentication.getAuthUri(),
      msg: 'Authentication required.'
    });
  }
});

exports.getDocuments = function(req, res) {
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

router.getElementList = function(req, res) {
  //var docId = "c8ffa48008c34653b6f96cf1";
  //var workId = "c75f16c93d2845afac5478d0";

  //console.log('****** getElementList token' + req.user.accessToken);
  //console.log('****** getElementList doc/work' + req.query.documentId + ' ' + req.query.workspaceId);
   //uri: 'https://partner.dev.onshape.com/api/elements/' + docId + "/workspace/" + workId,
  // uri: 'https://partner.dev.onshape.com/api/elements/' + docId + "/workspace/" + workId,

  request.get({
    uri: 'https://partner.dev.onshape.com/api/elements/' + req.query.documentId + "/workspace/" + req.query.workspaceId,
    headers: {
      'Authorization': 'Bearer ' + req.user.accessToken
    }
  }).then(function(data) {
    //console.log('****** getElementList - send data');

    res.send(data);
  }).catch(function(data) {
    console.log('****** getElementList - CATCH ' + data.statusCode);
    if (data.statusCode === 401) {
      authentication.refreshOAuthToken(req, res).then(function() {
        router.getElementList(req, res);
      }).catch(function(err) {
        console.log('Error refreshing token or getting elements: ', err);
      });
    } else {
      console.log('GET /api/documents/elements error: ', data);
    }
  });
};

router.getPartsList = function(req, res) {
  //var docId = "c8ffa48008c34653b6f96cf1";
  //var workId = "c75f16c93d2845afac5478d0";

  //uri: 'https://partner.dev.onshape.com/api/parts/' + docId + "/workspace/" + workId,

  request.get({
    uri: 'https://partner.dev.onshape.com/api/parts/' + req.query.documentId + "/workspace/" + req.query.workspaceId,
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
        console.log('Error refreshing token or getting elements: ', err);
      });
    } else {
      console.log('GET /api/parts/workspace error: ', data);
    }
  });
};

router.getStl = function(req, res) {
//  var binary = req.query.binary;
//  var documentId = req.query.documentId;
//  var elementId = req.query.stlElementId;
//  var workspaceId = req.query.workspaceId;
//  var partId = req.query.partId;
//  var angleTolerance = req.query.angleTolerance;
//  var chordTolerance = req.query.chordTolerance;

  console.log('****** getSTL token ' + req.user.accessToken);
  console.log('****** getSTL binary ' + req.query.binary);
  console.log('****** getSTL documentId ' + req.query.documentId);
  console.log('****** getSTL elementId ' + req.query.elementId);
  console.log('****** getSTL workspaceId ' + req.query.workspaceId);
  console.log('****** getSTL partId ' + req.query.partId);
  console.log('****** getSTL angleTolerance ' + req.query.angleTolerance);
  console.log('****** getSTL chordTolerance ' + req.query.chordTolerance);

//  var docId = "c8ffa48008c34653b6f96cf1";
//  var workId = "c75f16c93d2845afac5478d0";

//  var partId = '';

 // elementId = "d1c5d21b70d046599c50685f";

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

console.log('*** STL CALL - ' + url);

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
        getDocuments(req, res);
      }).catch(function(err) {
        console.log('Error refreshing token or getting elements: ', err);
      });
    } else {
      console.log('GET /api/parts/workspace error: ', data);
    }
  });
};

router.get('/documents', function(req, res) {
  getDocuments(req, res);
});

module.exports = router;
