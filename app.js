var express = require('express');
var path = require('path');
var favicon = require('static-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');

var proxy = require('./routes/proxy');
var onshape = require('./routes/onshape');

var app = express();

// An attempt to get the error handler implementations at the end to work without producing error messages
// saying that no engine has been configured. This changes the details of the error message, but does not eliminate
// it.  More investigation to be done.
// app.engine('html', require('ejs').renderFile);
// app.set('view engine', 'html');

app.set("view options", {layout: false});

app.use(favicon());
app.use(logger('default'));
//app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// routes
app.post('/checkLogin', onshape.checkLogin);
app.post('/proxy', proxy.proxy);
app.post('/notify', proxy.notify);
app.get('/notifyInfo/[a-zA-Z0-9]+', proxy.notifyInfo);
app.get('/', function(req, res) {res.redirect('/proxy');});

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
  app.use(function(err, req, res, next) {
    console.log(err);
    res.status(err.status || 500);
    res.render('error', {
        message: err.message,
        error: err
    });
  });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
  res.status(err.status || 500);
  res.render('error', {
    message: err.message,
    error: {}
  });
});


module.exports = app;
