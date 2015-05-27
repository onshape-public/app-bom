////////////////////////////////////////////////////////////////
// global data

var theQuery;
var theSession = null;
var theContext = {};
var notificationRegistrations = {};
var sessionID = "";
var ResultTable;

////////////////////////////////////////////////////////////////
// startup
//
$(document).ready(function() {

  // set globals
  theQuery = $.getQuery();

  // activate top of page tabs
  $("#dev-tabs").tabs({ active : 0 });

  initSessionTab();
  initPredefinedTab();
  initHeader();
  initNotificationsTab();
  initClientTab();
  initCategoryTab();

});


////////////////////////////////////////////////////////////////
// return information from Onshape
// this call is proxied through the application server
//
function showOnshapeInformation(params, element, altelement, altdisplay) {
  params.sessionID = sessionID;
  $.post("/proxy", params)
      .done(function( data ) {
        $(element).text(data);
        if (altdisplay) {
          altdisplay(data, altelement);
//      $(altelement).text(altdisplay(data));
        }
      })
      .fail(function() {
        $(element).text("call failed");
      })
}

////////////////////////////////////////////////////////////////
// return information from Onshape for a webhook call
// this call is proxied through the application server
//
function makeWebhookCall(params, doneFunc, failFunc) {
  params.sessionID = sessionID;
  $.post("/proxy", params)
      .done(doneFunc)
      .fail(failFunc);
}



////////////////////////////////////////////////////////////////
// header buttons (login, logout) support

function setLoggedIn(isLoggedIn) {
  if (isLoggedIn) {
    $("#logout").show();
    $("#login").hide();
    $("#dev-tabs").show();
    $("#context-table").show();
  } else {
    $("#logout").hide();
    $("#login").show();
    $("#dev-tabs").hide();
    $("#context-table").hide();
  }
}

function newLogin(loginData) {

  $("#theUser").text(loginData);
  $("#login-user").text(loginData);
  theContext.documentId = theQuery.documentId;
  $("#doc-id").text(theContext.documentId);
  theContext.workspaceId = theQuery.workspaceId;
  $("#ws-id").text(theContext.workspaceId);
  theContext.elementId = theQuery.elementId;
  theContext.partId = "";
  theContext.parts = [];
  theContext.selectedPart = -1;
  refreshSessionInformation();
  refreshContextElements();
  refreshContextParts();
  setLoggedIn(true);

  // send initial message to let Onshape know we're listening
  clientSendKeepalive();

}

function failedLogin() {

  $("#theUser").text("Not logged in");
  setLoggedIn(false);
  theSession = null;

}

function useExistingLogin() {

  var lp ={};
  lp.server = theQuery.server;
  lp.documentId = theQuery.documentId;
  lp.workspaceId = theQuery.workspaceId;
  lp.elementId = theQuery.elementId;

  $.post("/checkLogin", lp)
      .done(function(data) {
        if (data) {
          var p = $.parseJSON(data);
          sessionID = p.sessionID;
          newLogin('User ' + p.user + ' is logged in');
        }
      })
      .fail(function(data) {
        // no action required, will show login dialog
      });
}

// update the list of elements in the context header
function refreshContextElements()
{
  var path = "/api/elements/" + theContext.documentId + "/workspace/" + theContext.workspaceId + "?withThumbnails:false";
  var params = {name:"generic", method:"GET", path: path};
  params.sessionID = sessionID;

  $.post("/proxy", params)
      .done(function( data ) {
        try {
          // for each element, create a select option to make that element the current context
          $("#elt-select").empty();
          var obj = $.parseJSON(data);
          var id;
          for (var i=0; i<obj.length; ++i) {
            if (obj[i].type == 'ASSEMBLY') {
              $("#elt-select")
                  .append(
                  "<option value='" + obj[i].elementId + "'" +
                  (i == 0 ? " selected" : "") +
                  ">" +
                  obj[i].name + "</option>"
              )
                  .change(function () {
                    id = $("#elt-select option:selected").val();
                    theContext.elementId = id;
                    $("#elt-id").text(id);
                  }
              );
            }
          }
          theContext.elementId = $("#elt-select option:selected").val();
          $("#elt-id").text(theContext.elementId);
        }
        catch (err) {
          alert("Problem setting element list");
        }
      })
      .fail(function() {
        alert("Failed to set element list");
      });
}

function refreshContextParts()
{
  var path = "/api/parts/" + theContext.documentId + "/workspace/" + theContext.workspaceId;
  var params = {name:"generic", method:"GET", path: path};
  params.sessionID = sessionID;

  $.post("/proxy", params)
      .done(function( data ) {
        try {
          // add all parts to the part selection dropdown
          $("#part-select").empty();
          var obj = $.parseJSON(data);
          theContext.parts = obj;       // remember details to use in api calls later

          for (var i=0; i<obj.length; ++i) {
            $("#part-select")
                .append(
                "<option value='" + obj[i].name + "'" +
                (i==0 ? " selected" : "") +
                ">" +
                obj[i].name + "</option>"
            )
                .change(function() {
                  theContext.selectedPart = $("#part-select").prop("selectedIndex");
                  $("#part-id").text(obj[theContext.selectedPart].partId);
                });
            theContext.selectedParth = 0;
            $("#part-id").text(obj[0].partId);
          }
        }
        catch (err) {
          alert("Problem setting element list");
        }
      })
      .fail(function() {
        alert("Failed to set element list");
      });
}


function initContext() {
  $("#element-refresh").button().click(refreshContextElements);
  $("#part-refresh").button().click(refreshContextParts);
  $("#element-generate").button().click(onGenerate);
}

function initHeader() {
  useExistingLogin();
  initContext();
}


////////////////////////////////////////////////////////////////
// session tab support

function initSessionTab() {

  $("#session-refresh").button().click(refreshSessionInformation);
  showLocalSessionInformation();
}

// show local session information
function showLocalSessionInformation() {
  $("#theURL").text(window.location.href);
  var params = JSON.stringify(theQuery, null, "  ");
  $("#theParams").text(params);
}

// refresh all session information
function refreshSessionInformation() {
  showLocalSessionInformation();

  var params = {name: 'generic',
    method:'GET',
    path:'/api/users/session'};

  params.sessionID = sessionID;
  $.post("/proxy", params)
      .done(function( data ) {
        theSession = data;
        // parse returned data to set user context
        var s = JSON.parse(data);
        theContext.userId = s.id;

        $("#user-id").text(theContext.userId);
        $("#theUserDetails").text(theSession);
      })
      .fail(function() {
        theSession = null;
        $("#theUserDetails").text("Not logged in");
      });
}



////////////////////////////////////////////////////////////////
// client message tab support
//
//

var clientMessageList = [];
var theSelectedClientMessage = 0;

// define client message class
//
var clientMessage = function(messageName, name) {
  this.name = name;                 // friendly (menu) name
  this.messageName = messageName;   // message name
  this.doc = "No additional information available.";         // description
  this.messageBody = {"messageName" : messageName};

  clientMessageList.push(this);
}


function initClientMessages() {

  var msg;

  msg = new clientMessage('closeFlyoutsAndMenus', 'Close Flyouts and Menus');
  msg.doc = "Send when a mouse click or other event happens in the application element.  Closes Onshape flyouts and dropdown menus.";

  msg = new clientMessage('keepAlive', 'Keep Alive');
  msg.doc = "Send periodically by the application element while the user is actively working in it to avoid the browser session from timing out.";

  msg = new clientMessage('saveAVersion', 'Save a Version');
  msg.doc = "Send when the user types 'Shift-S' in the application element, the keyboard shortcut for save a version.";

  msg = new clientMessage('showKeyboardShortcutsHelp', 'Show Keyboard Shortcuts Help');
  msg.doc = "Send when the user types '?' (Shift-? on most keyboards) in the application element, the keyboard shortcut for the keyboard shortcuts help dialog.";

  msg = new clientMessage('openSelectItemDialog', 'Open Select Item Dialog');
  msg.doc = "Send when your application wants to open a dialog in which the user will select one or multiple items - blobs, parts, part studios or assemblies." +
  "<br />Optional properties:<br />" +
  "<pre>  dialogTitle: your dialog title   (default is no title),\n" +
  "  selectBlobs: bool   (default is false),\n" +
  "  selectParts: bool   (default is false),\n" +
  "  selectPartStudios: bool   (default is false),\n" +
  "  selectAssemblies: bool    (default is false),\n" +
  "  selectMultiple: bool      (default is false),\n" +
  "  selectBlobMimeTypes: string (default is empty string),\n" +
  "      comma-delimited string of blob mime types to show in dialog\n" +
  "      (e.g. 'application/dwt,application/dwg')";


  msg.messageBody["dialogTitle"] = "My Title";
  msg.messageBody["selectBlobs"] = false;
  msg.messageBody["selectParts"] = true;
  msg.messageBody["selectPartStudios"] = false;
  msg.messageBody["selectAssemblies"] = false;
  msg.messageBody["selectMultiple"] = false;
  msg.messageBody["selectBlobMimeTypes"] = "";

}


function clientLogMessage(desc, origin, name) {
  var d = new Date();
  msg = '[' +
  d.toDateString() + ' ' + d.toTimeString() +
  '] ' +
  desc + ' ' +
  JSON.stringify(origin) +
  ' ' +
  JSON.stringify(name) +
  '\n';
  $("#client-log").append(msg);
}

// called when we receive a client-side message
var handlePost = function(e) {
  clientLogMessage("rcvd", e.origin, e.data.messageName);

//  console.log(JSON.stringify(e.data));

  if (e.data.messageName == "itemSelectedInSelectItemDialog") {
    var details = "docId: [" + e.data.documentId + "] wsId: [" + e.data.workspaceId +
        "] verId: [" + e.data.versionId + "] eltId: [" + e.data.elementId +
        "] eltType: [" + e.data.elementType + "] partId: [" + e.data.partId + "]";
    clientLogMessage("    ", "", details);
  }


}

function clientSendMessage(msg) {
  // add context
  msg.documentId = theContext.documentId;
  msg.workspaceId = theContext.workspaceId;
  msg.elementId = theContext.elementId;

  parent.postMessage(msg, '*');
  clientLogMessage("sent", ".", msg.messageName);
}


// send a keepalive message
function clientSendKeepalive() {
  clientSendMessage( {messageName: 'keepAlive'} );
}


// submit button pressed.  Send current message
//
function clientSubmit() {

  msg = JSON.parse( $("#client-body").val() );
  clientSendMessage(msg);
}

// clear the message log
function clientClear() {
  $("#client-log").text("");
}

function selectClientMessage(idx)
{
  // show the documentation
  $("#client-desc").html(clientMessageList[idx].doc);
  $("#client-name").html(clientMessageList[idx].messageName);
  $("#client-body").val(JSON.stringify(clientMessageList[idx].messageBody, null, 2));
  theSelectedClientMessage = idx;

  // rebuild the message body
}


// query params have name, value, description
var optParams = [
  {pname: "q", pvalue: "test", pdesc: "query string"},
  {pname: "filter", pvalue: "0", pdesc: "integer specifying filter (default=0)<br />" +
  "0: 'My documents'<br />" +
  "1: 'Created by me'<br />" +
  "2: 'Shared with me'<br />" +
  "3: 'Trash'<br />" +
  "4: 'Public'<br />" +
  "5: 'Recently opened'<br />" +
  "6: 'By owner'<br />" +
  "7: 'By organization'" },
  {pname: "owner", pvalue: "", pdesc: "ID for 'by owner' or 'by organization' filters"},
  {pname: "ownerType", pvalue: "0", pdesc: "owner type (default=0)<br \>0 means user<br \>1 means organization"},
  {pname: "sortColumn", pvalue: "createdAt", pdesc: "sort column for results (default='createdAt'"},
  {pname: "offset", pvalue: "0", pdesc: "offset into full result set for paginated results (default=0)"},
  {pname: "limit", pvalue: "20", pdesc: "maximum number of results to return (default 20, max 20)"}

];

var currentAPI = {
  "apiName"           : "Document List",
  "apiDescription"    : "List documents available to this user.",
  "apiMethod"         : "GET",
  "apiURL"            : "/api/documents",
  "apiRequiredParams" : [],
  "apiOptionalParams" : optParams,
  "apiBody"           : ""
};

// helper functions for default arguments
var getContextDocument = function() {
  if (theContext.documentId) return '/' + theContext.documentId;
  else return "RESET to use current document ID";
}

var getContextWorkspace = function() {
  if (theContext.workspaceId) return '/workspace/' + theContext.workspaceId;
  else return "RESET to use current workspace ID";
}

var getContextElement = function() {
  if (theContext.elementId) return '/' + theContext.elementId;
  else return "RESET to use current element ID";
}

// map api name to api object
var apiname2obj = {};

// map category name to category object
var catMap = {};
var theCatManager = new catManager();

// define queryString class
function queryString() {
  this.text = "";

  this.extend = function(name, value) {
    this.text += ((this.text.length == 0) ? "?" : "&") +
    encodeURIComponent(name) +
    "=" +
    encodeURIComponent(value);
  }
}

// define category class
function category(name) {
  this.name = name;
  this.apiList = [];
  this.expanded = false;

  this.onTitleClick = function() {
    var theCategory = catMap[$(this).attr('catName')];

    if (theCategory.expanded) {
      theCategory.block.slideUp(200);
      theCategory.expanded = false;
    } else {
      theCategory.block.slideDown(200);
      theCategory.expanded = true;
    }
  }

  this.createDom = function() {
    this.title = $('<div class="catTitle">' + this.name + ' (' + this.apiList.length + ')</div>');
    this.title.attr('catName', this.name);
    this.title.click(this.onTitleClick);

    this.block = $('<div class="catBlock"></div>');
    this.block.attr('catName', this.name);
    this.block.hide();

    for (var i=0; i<this.apiList.length; ++i) {
      this.block.append(this.apiList[i].title);
      this.block.append(this.apiList[i].block);
    }

    $('#apis').append(this.title);
    $('#apis').append(this.block);
  }
}

// define category manager class
function catManager() {

  // add a new api, creating a new category if needed.
  this.addApi = function(theApi) {
    var cat = catMap[theApi.category];
    if (!cat) {
      cat = new category(theApi.category);
      catMap[theApi.category] = cat;
    }

    cat.apiList.push(theApi);
  }

  // call this to insert all categories into the dom
  this.insertDom = function() {
    var keys = Object.keys(catMap);
    for (var i=0; i<keys.length; ++i) {
      catMap[keys[i]].createDom();
    }
  }
}

// define api class
function api(name, category) {
  this.name = name;
  this.category = category;
  this.description = "";
  this.method = "";
  this.url = "";
  this.params = [];
  this.body = null;
  this.expanded = false;
  this.new = true;

  // dom references
  this.callTable = null;
  this.resultTable = null;

  // Create title dom
  this.title = $('<div class="title">' + this.name + '</div>');
  this.title.attr("apiName", this.name);

  // create block dom
  this.block = $('<div class="block"></div>');
  this.block.hide();
  this.block.attr("apiName", this.name);

  var callTable = $('<table></table>');
  callTable.addClass('callTable');
  var resultTable = $('<table></table>');
  resultTable.addClass('resultTable');

  this.block.append(callTable);
  this.block.append( $('<br />'));
  this.block.append( $('<span>Submit</span>').button().click(onSubmit) );
  this.block.append( $('<span>Reset</span>').button().click(onReset) );

  var cb = $('<span class="resultCheckbox"><input type="checkbox" class="CB" checked></input>Show results</span>');
  cb.find(".CB").click($.proxy(onClickResultCheckbox, cb, this, ".classResultRow" ));
  this.block.append(cb);

  cb = $('<span class="altResultCheckbox"><input type="checkbox" class="CB" checked></input>Show alt results</span>');
  cb.find(".CB").click($.proxy(onClickResultCheckbox, cb, this, ".classAltResultRow" ));
  this.block.append(cb);

  this.block.append( $('<br /><br />'));
  this.block.append(resultTable);

  // title click handler
  this.onTitleClick = function() {
    var theApi = apiname2obj[$(this).attr('apiName')];

    // setup show/hide on click in title
    if (theApi.new) {
      // one-time refresh to context on first open
      theApi.new = false;
      theApi.reset();
    };

    // show/hide api block
    if (theApi.expanded) {
      theApi.block.slideUp(200);
      theApi.expanded = false;
    } else {
      theApi.block.slideDown(200);
      theApi.expanded = true;
    }

  };

  // assign handler for click on title
  this.title.click(this.onTitleClick);

  // default display handlers
  this.showResults = function(data, b, c) {
    // for now, just dump data into the result table
    this.resultTable.find(".classResult").text(data);
  };

  this.showFailure = function(a,b,c) {
    this.resultTable.find(".classResult").text("Error: " + a.status + " (" + c + ")");
  };

  this.genAltResults = null;

  this.showAltResults = function(data) {
    if (this.genAltResults == null) return;
    var dom = this.resultTable.find(".classAltResult");
    this.genAltResults(data, dom);
  }

  this.createApiCallTable = function() {
    var table = $('<table></table>');
    table.addClass("callTable");

    table.append(createApiRow("API Name", this.name));
    table.append(createApiRow("Description", this.description));
    table.append(createApiRow("Method", $('<input size=30 class="classMethodValue" value="' + this.method + '"></input>'), "classMethod"));
    table.append(createApiRow("Base URL", $('<input size=30 class="classUrlValue" value="' + this.url + '"></input>'), "classUrl"));
    // add params - required and optional, url and query
    if (this.params.length > 0) {
      var paramTable = $('<table></table>');
      for (var i=0; i<this.params.length; ++i) {
        paramTable.append(this.params[i].createRow());
      }
      table.append(createApiRow("Parameters", paramTable, "paramTable"));
    }

    if (this.body != null) {
      var bodyObj = this.body();
      var bodyText = JSON.stringify(bodyObj, null, 2);
      var bodyDiv = $('<div><textarea cols=100 rows=12 class="classBodyValue">' + bodyText + '</textarea></div>');
      table.append(createApiRow("Body", bodyDiv, "classBody"));
    }

    this.callTable = table;
    this.block.find(".callTable").replaceWith(table);
  }

  this.createApiResultTable = function() {
    var table = $('<table></table>');
    table.addClass("resultTable");
    table.append(createApiRow("Calling:", "...", "classCall"));
    table.append(createApiRow("Result", "...", "classResult"));
    if (this.genAltResults != null) {
      table.append(createApiRow("Alt Result", "...", "classAltResult"));
      this.block.find(".altResultCheckbox").show();
    } else {
      this.block.find(".altResultCheckbox").hide();
    }
    this.resultTable = table;
    this.block.find(".resultTable").replaceWith(table);
  }

  this.buildPath = function() {

    var path = this.callTable.find(".classUrlValue").val();
    var reqUrlParams = this.callTable.find(".reqUrl");
    var optUrlParams = this.callTable.find(".optUrl");

    reqUrlParams.each( function() {
      path += $(this).find(".VL").val();
    });

    optUrlParams.each( function() {
      var cb = $(this).find(".CB");
      if ($(cb).is(':checked')) {
        path += $(this).find(".VL").val();
      }
    });

    var query = new queryString();

    // collect required query param rows
    var reqQueryParams = this.callTable.find(".reqQuery");

    // collect optional query param rows
    var optQueryParams = this.callTable.find(".optQuery");

    // for each required row
    reqQueryParams.each( function() {
      var name = $(this).find(".NM");
      var value = $(this).find(".VL");
      query.extend($(name).text(), $(value).val());
    });

    // for each optional row
    optQueryParams.each( function() {
      var cb = $(this).find(".CB");
      if ($(cb).is(':checked')) {
        var name = $(this).find(".NM");
        var value = $(this).find(".VL");
        query.extend($(name).text(), $(value).val());
      }
    });

    path += query.text;

    return path;
  }

  this.reset = function() {
    this.createApiCallTable();
    this.createApiResultTable();
  }

  this.submit = function() {

    // get optional body
    var body = (this.body) ? this.callTable.find(".classBodyValue").val() : "";

    // generate a calling block
    var callParams = {
      "name"   : "generic",
      "method" : this.callTable.find(".classMethodValue").val(),
      "path"   : this.buildPath(),
      "body"   : body
    };



//    callOnshape(callParams, this);
//    function callOnshape(callParams, theApi) {

//      resultTable = theApi.resultTable;

    // update display with call information
    var callText = callParams.method + ' ' + callParams.path;
    callText += '\n';
    callText += callParams.body;

    this.resultTable.find(".classCall").text(callText);
    this.resultTable.find(".classResult").text('calling...');
    if (this.genAltResults) {
      this.resultTable.find(".classAltResult").empty().append('calling...');
    };

    self = this;
    callParams.sessionID = sessionID;
    $.post("/proxy", callParams)
        .done( function(data, b, c) {
          self.showResults(data, b, c);
          if (self.genAltResults) {
            self.showAltResults(data);
          }
        })
        .fail( function(a,b,c) {
          self.showFailure(a,b,c);
        })
  }

  // setup map
  apiname2obj[name] = this;

  // add to category manager
  theCatManager.addApi(this);
}

// define param class
function param(isRequired, isUrl, name) {
  this.isRequired = isRequired;
  this.isUrl = isUrl; // Url or Param
  this.name = name;
  this.getDefault = function() {return "default";};
  this.doc = "no description available";
  this.class = (this.isRequired ? "req" : "opt") + (this.isUrl ? "Url" : "Query");

  this.createRow = function() {
    var row = $('<tr></tr>');
    row.addClass(this.class);

    var name = $('<span class="NM">' + this.name + '</span>');
    var cb   = $('<input type="checkbox" class="CB"></input>');
    var val  = $('<input size=30 class="VL" value="' + this.getDefault() + '"></input>');

    var cellName  = $('<td></td>');
    var cellValue = $('<td></td>');
    var cellDoc   = $('<td></td>');

    if (!this.isRequired) {
      cellName.append(cb);
    }
    cellName.append(name);
    cellValue.append(val);
    cellDoc.append(this.doc);

    row.append(cellName);
    row.append(cellValue);
    row.append(cellDoc);

    return row;
  };
}

function onClickResultCheckbox(api, className) {
  if (this.find(".CB").is(':checked')) {
    api.resultTable.find(className).show();
  } else {
    api.resultTable.find(className).hide();
  }
}

// create one API row
// use dataclass only if provided
function createApiRow(label, data, dataclass, doc) {
  var row = $('<tr></tr>');
  if (label == "Result") row.addClass("classResultRow");
  if (label == "Alt Result") row.addClass("classAltResultRow");

  var labelCell = $('<td></td>');

  labelCell.append('<span>' + label + '</span>');
  labelCell.addClass('rowlabel');

  row.append(labelCell);

  var cell = $('<td class="rowdata"></td>');
  if (dataclass) {
    cell.addClass(dataclass);
  }
  cell.append(data);
  row.append(cell);

  if (doc) {
    var docCell = $('<td class="rowdata">' + doc + '</td>');
    row.append(docCell);
  }

  return row;
}

function onReset() {
  var theApi = apiname2obj[$(this.parentElement).attr('apiName')];
  theApi.reset();
}


function onSubmit() {

  var theApi = apiname2obj[$(this.parentElement).attr('apiName')];
  theApi.submit();
}


function initCategoryTab() {

}


/*
 // test tab initialization

 // API organization


 categories:
 "Users",
 "Documents",
 "Elements",
 "Parts",
 "Export",
 "Models",
 "Drawings",
 "Application Storage",
 "Application Settings",
 "Webhooks"

 */

function initClientTab() {

  initClientMessages();

  for (var i=0; i<clientMessageList.length; ++i) {
    $("#client-select")
        .append("<option value='" + i + "'>" + clientMessageList[i].name + "</option>")
        .change( function() {
          var idx = $("#client-select option:selected").val();
          selectClientMessage(idx);
        });
  }
  // preselect first message
  selectClientMessage(0);

  // create submit and clear buttons
  $("#client-submit").button().click(clientSubmit);
  $("#client-clear").button().click(clientClear);

  // listen for client messages
  window.addEventListener('message', handlePost, false);
}


function xlateBase64(str) {
  var p;
  try {
    p = atob(str);
  }
  catch (err) {
    p = err;
  }
  return p;
}


////////////////////////////////////////////////////////////////
// predefined tab support
//
//


var predefs = [

  {
    "dname"   : "Document List",
    "desc"    : 'Returns a list of documents.' +
    'Call: GET /api/documents\n' +
    '<pre>' +
    '  Optional query params:\n' +
    '    &q=string        // query string to select results\n' +
    '    &filter=int      // integer specifying filter (default 0)\n' +
    '    &owner=id        // owner id for "By owner" or "By organization" filter\n' +
    '    &ownerType=int   // owner type (default 0) - 0 means user, 1 means organization\n' +
    '    &sortColumn=string  // sort column for results (default "createdAt")\n' +
    '    &offset=int      // offset into full result set for paginated results (default 0)\n' +
    '    &limit=int       // maximum number of results to return (default 20, max 20)\n' +
    'Valid filter types are:\n'+
    '  0: "My documents"\n' +
    '  1: "Created by me"\n' +
    '  2: "Shared with me"\n' +
    '  3: "Trash"\n' +
    '  4: "Public"\n' +
    '  5: "Recently opened"\n' +
    '  6: "By owner"\n' +
    '  7: "By organization"\n',
    "method"  : "GET",
    "urlFcn"  : function() { return "/api/documents" }
  },

  {
    "dname"   : "Document Information",
    "desc"    : "Returns information about a document.",
    "method"  : "GET",
    "urlFcn"  : function() { return "/api/documents/" + theContext.documentId }
  },

  {
    "dname"   : "List Elements in Document",
    "desc"    : "Returns information about the elements in a document.",
    "method"  : "GET",
    "urlFcn"  : function() { return "/api/elements/" + theContext.documentId + "/workspace/" + theContext.workspaceId + "?withThumbnails:true" }
  },

  {
    "dname"   : "Parts in a workspace",
    "desc"    : "Returns all parts available in the current workspace of a document.",
    "method"  : "GET",
    "urlFcn"  : function() { return "/api/parts/" + theContext.documentId + '/workspace/' + theContext.workspaceId },
  },

  {
    "dname"   : "Retrieve content",
    "desc"    : "Returns the data stored in a tab.  This works for 'blob' elements only.<br />" +
    'Call: GET /api/elements/download/DID/EID?workspaceId=WID',
    "method"  : "GET",
    "urlFcn"  : function() { return "/api/elements/download/" + theContext.documentId + "/" + theContext.elementId + "?workspaceId=" + theContext.workspaceId }
  },

  {
    "dname"   : "Export to Parasolid format",
    "desc"    : "Export a model in Parasolid format.<br />" +
    'Call: GET /api/documents/DID/export/EID?workspaceId=WID&format=PS\n' +
    '<pre>' +
    '  Optional query params:\n' +
    '  &partIds=string      // optional part IDs\n' +
    '  &partQuery=string    // optional part Query\n' +
    '  &version=string      // option string in form XX.Y\n</pre>' +
    '<p>Note: this call returns a 307 (redirect) - redirect to the returned "location" header.</p>',
    "method"  : "GET",
    "urlFcn"  : function() { return "/api/documents/" + theContext.documentId + "/export/" + theContext.elementId + "?workspaceId=" + theContext.workspaceId + "&format=PS" }
  },

  {
    "dname"   : "Export to STL format",
    "desc"    : "Export a model in STL format.<br />" +
    'Call: GET /api/documents/DID/export/EID?workspaceId=WID&format=STL&mode=MODE&scale=SCALE&units=UNITS\n' +
    '<pre>' +
    '  Required query params:\n' +
    '    &workspaceId=string  // workspace\n' +
    '    &mode=string         // either "binary" or "text"\n' +
    '    &scale=double        // scale the model dimensions. Value of 1 means no scaling\n' +
    '    &units=string        // a supported unit, such as "meter", "centimeter", "inch"\n' +
    '  Optional query params:\n' +
    '    &partIds=string      // comma-separated list of part Ids\n' +
    '    &angleTolerance=double // maximum angular tolerance in radians (less than pi/2)' +
    '    &chordTolerance=double // maximum distance between a curve and the chord (value in specified units)' +
    '<p>Note: this call returns a 307 (redirect) - redirect to the returned "location" header.</p>',
    "method"  : "GET",
    "urlFcn"  : function() { return "/api/documents/" + theContext.documentId + "/export/" + theContext.elementId + "?workspaceId=" +
        theContext.workspaceId + "&format=STL&mode=text&scale=1&units=meter" }
  },

  {
    "dname"   : "Tessellated Edges",
    "desc"    : "Returns tessellated edges for requested model in JSON format.<br />" +
    'Arguments:' +
    '<pre>'+
    '{\n' +
    '  "documentId"     : "&lt;doc id&gt;",       // required string\n' +
    '  "elementId"      : "&lt;element id&gt;",   // required string\n' +
    '  "workspaceId"    : "&lt;workspace id&gt;", // optional string\n' +
    '  "partQuery"      : "&lt;part query&gt;",   // optional string\n' +
    '  "partId"         : "&lt;part id&gt;",      // optional string\n' +
    '  "angleTolerance" : "&lt;tolerance&gt;",    // optional double\n' +
    '  "chordTolerance" : "&lt;tolerance&gt;",    // optional double\n' +
    '  "outputVertexNormals": false         // optional boolean\n' +
    '}\n</pre>',
    "method"  : "POST",
    "urlFcn"  : function() { return "/api/models/tessellatededges" },
    "bodyFcn" : function() {
      var tess = {documentId: theContext.documentId, elementId: theContext.elementId, workspaceId: theContext.workspaceId};
      return JSON.stringify(tess, null, 2);
    }
  },

  {
    "dname"   : "Tessellated Faces",
    "desc"    : "Returns tessellated faces for requested model in JSON format.<br />" +
    'Arguments:' +
    '<pre>'+
    '{\n' +
    '  "documentId"     : "&lt;doc id&gt;",       // required string\n' +
    '  "elementId"      : "&lt;element id&gt;",   // required string\n' +
    '  "workspaceId"    : "&lt;workspace id&gt;", // optional string\n' +
    '  "partQuery"      : "&lt;part query&gt;",   // optional string\n' +
    '  "partId"         : "&lt;part id&gt;",      // optional string\n' +
    '  "angleTolerance" : "&lt;tolerance&gt;",    // optional double\n' +
    '  "chordTolerance" : "&lt;tolerance&gt;",    // optional double\n' +
    '  "outputVertexNormals": false         // optional boolean\n' +
    '}\n</pre>',
    "method"  : "POST",
    "urlFcn"  : function() { return "/api/models/tessellatedfaces" },
    "bodyFcn" : function() {
      var tess = {documentId: theContext.documentId, elementId: theContext.elementId, workspaceId: theContext.workspaceId};
      return JSON.stringify(tess, null, 2);
    }
  },

  {
    "dname"   : "Bounding Box",
    "desc"    : "Returns the bounding box for the requested element.<br />" +
    'Arguments:' +
    '<pre>'+
    '{\n' +
    '  "documentId"     : "&lt;doc id&gt;",       // required string\n' +
    '  "elementId"      : "&lt;element id&gt;",   // required string\n' +
    '  "workspaceId"    : "&lt;workspace id&gt;", // optional string\n' +
    '  "partQuery"      : "&lt;part query&gt;",   // optional string\n' +
    '  "includeHidden   : true"                   // boolean\n'         +
    '}\n</pre>',
    "method"  : "POST",
    "urlFcn"  : function() { return "/api/models/boundingbox" },
    "bodyFcn" : function() {
      var body = {documentId: theContext.documentId, elementId: theContext.elementId, workspaceId: theContext.workspaceId, partQuery: null, includeHidden: true};
      return JSON.stringify(body, null, 2);
    }
  },

  {
    "dname"   : "Shaded View",
    "desc"    : "Returns shaded view for requested model.<br />" +
    'Arguments:' +
    '<pre>'+
    '[{\n' +
    '  "documentId"     : "&lt;document id&gt;",        // required string\n' +
    '  "elementId"      : "&lt;element id&gt;",         // required string\n' +
    '  "workspaceId"    : "&lt;element id&gt;",         // optional string\n' +
    '  "viewMatrix"     : [1,0,0,0,0,1,0,0,0,0,1,0], // required matrix\n'+
    '  "outputHeight"   : 600,                    // required int\n' +
    '  "outputWidth"    : 800,                    // required int\n' +
    '  "pixelSize"      : 0.01                    // required double\n' +
    '}]\n</pre>',
    "method"  : "POST",
    "urlFcn"  : function() { return "/api/drawings/shaded" },
    "bodyFcn" : function() {
      var view = {
        documentId: theContext.documentId,
        viewMatrix: [1,0,0,0,0,1,0,0,0,0,1,0],
        elementId: theContext.elementId,
        outputHeight: 600,
        outputWidth: 800,
        pixelSize: 0.01};
      return JSON.stringify(view, null, 2);
    },
    "altDisplay" : function(data, domElement) {
      var html;
      try {
        var res = JSON.parse(data);
        var image = res.images[0];
        html = "<img alt='shaded view' src='data:image/png;base64," + image + "' />";
      } catch (err) {
        html = "<p> " + err + "</p>";
      }
      $(domElement).html(html);
    }
  },



  {
    "dname"   : "Create Application Element",
    "desc"    : "Create a new application element.<br />" +
    '<pre>' +
    'POST /api/elements/application/DOCID/workspace/WSID\n' +
    '   NOTE: subelements array may be empty\n' +
    '{\n' +
    '  "formatId" : "Onshape-assigned-format-id",\n' +
    '  "subelements"   : [ { "subelementId" : "some-string",\n' +
    '                        "baseContent"  : "some-base64-string" },\n' +
    '                      { ... }\n'+
    '                    ],\n' +
    '  "name"          : "Element name",\n' +
    '  "description"   : "Element description"\n' +
    '}' +
    '</pre>',
    "method"  : "POST",
    "urlFcn"  : function() { return "/api/elements/application/" + theContext.documentId + "/workspace/" + theContext.workspaceId },
    "bodyFcn" : function() {
      var appBody =
      {
        "formatId" : "onshape-test/devtest",
        "subelements"   : [{subelementId: "stuff", baseContent: btoa("the first one")}],
        "name"          : "Test Application Element",
        "description"   : "Create test application element"
      };
      return JSON.stringify(appBody, null, 2);
    }
  },

  {
    "dname"   : "Get Subelement Ids",
    "desc"    : "Get a list of subelement ids.<br />" +
    '<pre>' +
    'GET /api/elements/application/content/ids/DOCID/ELTID/workspace/WSID\n'+
    '  OPTIONAL query params\n'+
    '  ?transactionId= (microbranch of the element in which keys are retrieved)\n'+
    '  ?changeId= (microversion of the element in which keys are retrieved)\n' +
    '</pre>',
    "method"  : "GET",
    "urlFcn"  : function() { return "/api/elements/application/content/ids/" + theContext.documentId + "/" + theContext.elementId + "/workspace/" + theContext.workspaceId }
  },

  {
    "dname"   : "Get History",
    "desc"    : "Get element change history.<br />" +
    '<pre>' +
    'GET /api/elements/application/content/history/DOCID/ELTID/workspace/WSID\n'+
    '</pre>',
    "method"  : "GET",
    "urlFcn"  : function() { return "/api/elements/application/content/history/" + theContext.documentId + "/" + theContext.elementId + "/workspace/" + theContext.workspaceId }
  },

  {
    "dname"   : "Add or Update Application Content",
    "desc"    : "Add or update the content of an application element.<br />" +
    '<pre>' +
    'POST /api/elements/application/content/DOCID/ELTID/workspace/WSID\n'+
    '{\n'+
    '  "changes" : [ { "subelementId" : "theSubId",\n'+
    '                  "baseContent   : "base-base64-string" },\n'+
    '                { "subelementId" : "theSubId",\n'+
    '                  "delta"        : "change-base64-string" },'+
    '              ],\n'+
    '   "transactionId"  : "optional-transaction-id",\n'+
    '   "parentChangeId" : "optional-change-id",\n'+
    '   "description"    : "description-string"\n'+
    '}\n'+
    '</pre>',
    "method"  : "POST",
    "urlFcn"  : function() { return "/api/elements/application/content/" + theContext.documentId + "/" + theContext.elementId + "/workspace/" + theContext.workspaceId },
    "bodyFcn" : function() {
      var d = new Date();
      var updateBody =
      {
        changes:      [{subelementId: "stuff", delta: btoa(d.toDateString() + ' ' + d.toTimeString())}],
        description:  "Added stuff"
      };
      return JSON.stringify(updateBody, null, 2);
    }
  },

  {
    "dname"   : "Retrieve Application Element Content",
    "desc"    : "Read the content of an application element.<br />" +
    'Note that base and delta content is BASE64 encoded.<br >'+
    '<pre>' +
    'GET /api/elements/application/content/DOCID/ELTID/workspace/WSID\n'+
    '  OPTIONAL query params\n'+
    '  ?transactionId= (microbranch of the element in which keys are retrieved)\n'+
    '  ?changeId= (id for the microversion to retrieve)\n' +
    '  ?baseChangeId= (limit content relative to this base)\n' +
    '  ?subElementId= (restrict output to this key - default is all keys)\n' +
    '</pre>',
    "method"  : "GET",
    "urlFcn"  : function() { return "/api/elements/application/content/" + theContext.documentId + "/" + theContext.elementId + "/workspace/" + theContext.workspaceId },
    "altDisplay" : function(data, domElement) {
      try {
        var p = $.parseJSON(data);
        for (var subs = 0; subs < p.data.length; ++subs) {
          var pd = p.data[subs];
          pd.baseContent = xlateBase64(pd.baseContent);    // decode base64 for base content
          var deltas = pd.deltas;
          for (var i=0; i<deltas.length; ++i) {
            deltas[i].delta = xlateBase64(deltas[i].delta);  // decode base64 for delta content
          }
          $(domElement).text("BASE64 decode: \n" + JSON.stringify(p, null, 2));
          return;
        }
      } catch (err) {
        $(domElement).text("Error parsing result: " + err);
        return;
      }
    }
  },

  {
    "dname"   : "Track Element Changes",
    "desc"    : "Register for notifications of changes to an element.<br />" +
    '<pre>' +
    'POST /api/webhooks\n'+
    '{\n'+
    '  "id" : "optional-existing-webhook-id",\n'+
    '  "url" : "URL for webhook callback",\n'+
    '  "events" : [ "event-name" ... ],URL for webhook callback",\n'+
    '  "filter" : "an-event-filter",\n'+
    '  "data" : "optional-data",\n'+
    '  "options" : { "collapseEvents" : true-or-false }\n'+
    '}\n'+
    '</pre>',
    "method"  : "POST",
    "urlFcn"  : function() { return "/api/webhooks" },
    "bodyFcn" : function() {
      var hookBody =
      {
        "url" : window.location.protocol + "//" + window.location.host + "/notify",
        "events" : [ "onshape.model.lifecycle.changed" ],
        "filter" : "{$DocumentId} = '" + theContext.documentId + "'&&" +
        "{$WorkspaceId} = '" + theContext.workspaceId + "'&&" +
        "{$ElementId} = '" + theContext.elementId + "'",
        "data"   : "Some data",
        "options"   : { "collapseEvents" : false }
      };
      return JSON.stringify(hookBody, null, 2);
    }
  },

  {
    "dname"   : "Store Application Settings",
    "desc"    : "Store user-specific application settings.<br />" +
    '<pre>' +
    'POST /api/users/USERID/appsettings/APPID\n'+
    '</pre>',
    "method"  : "POST",
    "urlFcn"  : function() { return "/api/users/" + theContext.userId + "/appsettings/" + "abcdefghijklmnopqrstuvwx" },
    "bodyFcn" : function() {
      var settings = { settings: [
        {key: "aString", value: "aStringValue"},
        {key: "anInt", value: 12345},
        {key: "aFloat", value: 123.456},
        {key: "aBool", value: true},
        {key: "anArray", value: [1, 2, 3]},
        {key: "anObject", value: {p1: "p1", p2: "p2"}}
      ] }
      return JSON.stringify(settings, null, 2);
    }
  },

  {
    "dname"   : "Get Application Settings",
    "desc"    : "Get previously stored user-specific application settings.<br />" +
    '<pre>' +
    'GET /api/users/USERID/appsettings/APPID\n'+
    '  Query params\n'+
    '  ?key=KEY1\n' +
    '  &key=KEY2... (optional additional keys)\n' +
    '</pre>',
    "method"  : "GET",
    "urlFcn"  : function() { return "/api/users/" + theContext.userId + "/appsettings/" + "abcdefghijklmnopqrstuvwx" +
        "?key=aString&key=anInt&key=aFloat&key=aBool&key=anArray&key=anObject&key=NOKEY";
    }
  }

];

var theSelectedApi = 0;

// rebuild the selection when the context changes
function rebuildApiCall() {
  var idx = theSelectedApi;

  // load the build table
  $("#predef-name").text(predefs[idx].dname);
  $("#predef-method").val(predefs[idx].method);
  $("#predef-url").val(predefs[idx].urlFcn());
  $("#predef-body").val( ((predefs[idx].hasOwnProperty)('bodyFcn') ? predefs[idx].bodyFcn() : "") );
}

// called when the selection list changes
function selectPredefinedApi(idx) {
  // show the documentation
  $("#predefined-desc").html(predefs[idx].desc);
  theSelectedApi = idx;
  rebuildApiCall();
}


function initPredefinedTab() {

  for (var i=0; i<predefs.length; ++i) {
    $("#predefined-select")
        .append("<option value='" + i + "'>" + predefs[i].dname + "</option>")
        .change(function() {
          var idx = $("#predefined-select option:selected").val();
          selectPredefinedApi(idx);
        });
  }

  // preselect first item
  selectPredefinedApi(0);

  // create submit button
  $("#predefined-submit").button().click(predefinedSubmit);
}


// NOT USED?
function showPredefResults(params) {
  $("#predefined-call").text(params.method + " " + params.path + " " + params.body);
  showOnshapeInformation(params, "#predefined-results");
}


function predefinedSubmit() {

  // copy build data to result section
  $("#called-name").text($("#predef-name").text());
  $("#called-args").text(
      $("#predef-method").val() + ' ' +
      $("#predef-url").val() + '\n' +
      $("#predef-body").val() );

  $("#called-results").text("Calling...");
  $("#called-altresults").text("");

  var callParams = {name: 'generic', method:$("#predef-method").val(), path:$("#predef-url").val(), body:$("#predef-body").val()};

  if (predefs[theSelectedApi].altDisplay) {
    showOnshapeInformation( callParams, "#called-results", "#called-altresults", predefs[theSelectedApi].altDisplay);
  } else {
    showOnshapeInformation( callParams, "#called-results");
  }

}

///////////////////////////////
// notifications support

var theSelectedWebhook = null;
var notificationRegistrations = {};

// called when the selection list choice changes
function selectWebhook(webhookId) {
  theSelectedWebhook = webhookId;
  if (webhookId) {
    var webhookInfo = notificationRegistrations[webhookId];
    $("#webhook-event").html(webhookInfo.events[0]);
    $("#webhook-document").html(webhookInfo.documentId);
    $("#webhook-element").html(webhookInfo.elementId);
    $("#webhook-workspace").html(webhookInfo.workspaceId);

    $("#webhook-unregister").button("option", "disabled", false);
    $("#webhook-refresh").button("option", "disabled", false);
    $("#webhook-ping").button("option", "disabled", false);
  } else {
    theSelectedWebhook = null;
    $("#webhook-event").html("");
    $("#webhook-document").html("");
    $("#webhook-element").html("");
    $("#webhook-workspace").html("");

    $("#webhook-unregister").button("option", "disabled", true);
    $("#webhook-refresh").button("option", "disabled", true);
    $("#webhook-ping").button("option", "disabled", true);
  }
}


function initNotificationsTab() {

  // create webhook buttons
  $("#webhook-register").button().click(webhookRegister);
  $("#webhook-unregister").button().click(webhookUnregister);
  $("#webhook-refresh").button().click(webhookRefresh);
  $("#webhook-ping").button().click(webhookPing);

  updateWebhookOptions();
}

function updateWebhookOptions(selected) {

  var firstHook = null;
  $("#webhook-select").empty();
  for (var key in notificationRegistrations) {
    if (notificationRegistrations.hasOwnProperty(key)) {
      if (!firstHook) {
        firstHook = key;
      }
      $("#webhook-select")
          .append("<option value='" + key + "'>" + key + "</option>")
          .change(function() {
            var webhook = $("#webhook-select option:selected").val();
            selectWebhook(webhook);
          });
    }
  }

  if (!selected) {
    selected = firstHook;
  }

  selectWebhook(selected);
}


function webhookRegister() {

  // register for notification of changes to the context element
  var webhookBody = JSON.stringify({
    "url" : window.location.protocol + "//" + window.location.host + "/notify",
    "events" : [ "onshape.model.lifecycle.changed" ],
    "filter" : "{$DocumentId} = '" + theContext.documentId + "'&&" +
    "{$WorkspaceId} = '" + theContext.workspaceId + "'&&" +
    "{$ElementId} = '" + theContext.elementId + "'",
    "data"   : "Some data",
    "options"   : { "collapseEvents" : false }
  }, null, 2);

  var callParams = {name:"generic", method:"POST", path:"/api/webhooks", body:webhookBody};

  $("#webhook-result").text("request sent");
  makeWebhookCall(
      callParams,
      function( data ) {
        var registerData = JSON.parse(data);
        registerData.documentId = theContext.documentId;
        registerData.elementId = theContext.elementId;
        registerData.workspaceId = theContext.workspaceId;
        addWebhook(registerData);
        $("#webhook-result").text(""); },
      function( ) {
        $("#webhook-result").text("Register failed");
      }
  );
}

function webhookUnregister() {

  var webhookId = theSelectedWebhook;

  // de-register the selected webhook
  if (!webhookId) {
    $("#webhook-result").text("No hook selected");
    return;
  }

  var callParams = {name:"generic", method:"DELETE", path:"/api/webhooks/" + webhookId};

  $("#webhook-result").text("request sent");
  removeWebhook(webhookId);
  makeWebhookCall(callParams,
      function( data ) {
        $("#webhook-result").text(""); },
      function( ) {
        $("#webhook-result").text("Unregister failed"); });
}

function webhookPing() {

  var webhookId = theSelectedWebhook;

  // ping the selected webhook
  if (!webhookId) {
    $("#webhook-result").text("No hook selected");
    return;
  }

  var callParams = {name:"generic", method:"POST", path:"/api/webhooks/" + webhookId + "/ping"};

  $("#webhook-result").text("request sent");
  makeWebhookCall(callParams,
      function( data ) {
        $("#webhook-result").text(""); },
      function( ) {
        $("#webhook-result").text("Ping failed"); });
}

// Temporary implementation until we get websocket updates implemented
function webhookRefresh() {

  var webhookId = theSelectedWebhook;

  if (!webhookId) {
    $("#webhook-result").text("No hook selected");
    return;
  }

  $.get("/notifyInfo/" + webhookId)
      .done(function(data) {
        var jsonData = JSON.parse(data);
        $("#webhook-result").text("");
        $("#webhook-call-id").text(webhookId);
        $("#webhook-call-count").text(jsonData.notificationCount);
        $("#webhook-last-message").text(JSON.stringify(jsonData.lastNotification, null, 2));
      })
      .fail(function() {
        $("#webhook-result").text("failed");
      });
}

function addWebhook(registerData) {
  if (registerData.id) {
    registerData.webhookId = registerData.id;
    notificationRegistrations[registerData.id] = registerData;
    updateWebhookOptions(registerData.id);
  }
}

function removeWebhook(webhookId) {
  delete notificationRegistrations[webhookId];
  updateWebhookOptions();
}

/////////////////////////////////////
//
// Primary BOM generation function
//
var realSize = 0.001;
var tX = 0;
var tY = 0;
var tZ = 0;

function onGenerate() {
  // Destroy anything previously created ...
  $('#apis').empty();

  // Get the bounding box size
  var bodyBox = {
    "documentId": theContext.documentId,
    "elementId": theContext.elementId,
    "workspaceId": theContext.workspaceId,
    "partQuery": null,
    "includeHidden": false
  }
  var callBoxParams = {
    "name": "generic",
    "method": "POST",
    "path": "/api/models/boundingbox",
    "sessionID": sessionID,
    "body": JSON.stringify(bodyBox, null, 2)
  }

  $.post("/proxy", callBoxParams)
      .done(function (data) {
        try {
          var res = JSON.parse(data);
          var xLow = res.lowX;
          var xHigh = res.highX;
          var yLow = res.lowY;
          var yHigh = res.highY;
          var zLow = res.lowZ;
          var zHigh = res.highZ;

          // Get the size of the BBox
          var xDiff = xHigh - xLow;
          var yDiff = yHigh - yLow;
          var zDiff = zHigh - zLow;
          realSize = Math.sqrt(xDiff * xDiff + yDiff * yDiff + zDiff * zDiff);

          // Find the center of the BBox - model coordinates
          var xCenter = (xHigh + xLow) / 2;
          var yCenter = (yHigh + yLow) / 2;
          var zCenter = (zHigh + zLow) / 2;

          tX = xCenter * 0.707 + xCenter * -0.409 + xCenter * 0.577;
          tY = yCenter * 0.707 + yCenter * 0.409 + yCenter * -0.577;
          tZ = zCenter * 0 + zCenter * 0.816 + zCenter * 0.577;

          // Now, finish the rest of the work.
          onGenerate2();
        }
        catch (err) {
        }
      })
      .fail(function () {
        alert("Problem with bounding box");
      });
}

//
// Keep track of all the components and sub-assemblies we find.
//
var Comp2Array = [];
var SubAsmArray = [];
var ThumbPromises = [];

function generateBBox(elementId) {
  return new Promise(function(resolve, reject) {
    // Get the bounding box size
    var bodyBox = {
      "documentId": theContext.documentId,
      "elementId": elementId,
      "workspaceId": theContext.workspaceId,
      "partQuery": null,
      "includeHidden": false
    }
    var callBoxParams = {
      "name": "generic",
      "method": "POST",
      "path": "/api/models/boundingbox",
      "sessionID": sessionID,
      "body": JSON.stringify(bodyBox, null, 2)
    }

    $.post("/proxy", callBoxParams)
      .done(function (data) {
        try {
          var res = JSON.parse(data);
          var xLow = res.lowX;
          var xHigh = res.highX;
          var yLow = res.lowY;
          var yHigh = res.highY;
          var zLow = res.lowZ;
          var zHigh = res.highZ;

          // Get the size of the BBox
          var xDiff = xHigh - xLow;
          var yDiff = yHigh - yLow;
          var zDiff = zHigh - zLow;
          bSize = Math.sqrt(xDiff * xDiff + yDiff * yDiff + zDiff * zDiff);

          // Find the center of the BBox - model coordinates
          var xCenter = (xHigh + xLow) / 2;
          var yCenter = (yHigh + yLow) / 2;
          var zCenter = (zHigh + zLow) / 2;

          var bX = xCenter * 0.707 + xCenter * -0.409 + xCenter * 0.577;
          var bY = yCenter * 0.707 + yCenter * 0.409 + yCenter * -0.577;
          var bZ = zCenter * 0 + zCenter * 0.816 + zCenter * 0.577;

          // Now, finish the rest of the work.
          generateThumbs({'Element' : elementId, 'xCtr' : bX, 'yCtr' : bY, 'zCtr' : bZ, 'size' : bSize });
          resolve(1);
        }
        catch (err) {
          reject(1);
        }
      })
      .fail(function () {
          reject(1);
      });
  });
}

var ImagesArray = [];

function generateThumbs(argMap) {

  var thumb = new Promise(function(resolve, reject) {

    var elementId = argMap.Element;
    var xCtr = argMap.xCtr;
    var yCtr = argMap.yCtr;
    var zCtr = argMap.zCtr;
    var size = argMap.size;

    var body = {
    "documentId": theContext.documentId,
    "elementId": elementId,
    "workspaceId": theContext.workspaceId,
    "viewMatrix": [0.707, 0.707, 0, xCtr, -0.409, 0.409, 0.816, yCtr, 0.577, -0.577, 0.577, zCtr],
    "outputHeight": 50,
    "outputWidth": 50,
    "pixelSize": size / 50
  }
  var callParams = {
    "name": "generic",
    "method": "POST",
    "path": "/api/drawings/shaded",
    "sessionID": sessionID,
    "body": JSON.stringify(body, null, 2)
  }

  var imageString = "";

  $.post("/proxy", callParams)
      .done(function (data) {
        try {
          var res = JSON.parse(data);
          if (res.images.length > 0) {
            ImagesArray[ImagesArray.length] = {
              Image : res.images[0],
              Element : elementId
            }
          }
          resolve(1);
        }
        catch (err) {
          reject(0);
        }
      })
      .fail(function () {
        resolve(0);
      });
  });

  ThumbPromises.push(thumb);
}

function findAssemblies(resolve, reject) {
  var path = "/api/elements/" + theContext.documentId + "/workspace/" + theContext.workspaceId + "?withThumbnails:false";
  var params = {name:"generic", method:"GET", path: path};
  params.sessionID = sessionID;

  $.post("/proxy", params)
      .done(function( data ) {
        try {
          // for each element, create a select option to make that element the current context
          var obj = $.parseJSON(data);
          var id;
          for (var i = 0; i < obj.length; ++i) {
            if (obj[i].type == 'ASSEMBLY') {
              // Add this to the list of assemblies
              SubAsmArray[SubAsmArray.length] = {
                Element: obj[i].elementId,
                Count: 0,
                Handled: false,
                Name : obj[i].name,
                Components : []
              }
            }
          }

          resolve(SubAsmArray);
        }
        catch (err) {
          reject("Problem fetching elements");
        }
      });
}

function saveComponentToList(asmIndex, itemName, asmElementId, partElementId) {
  var found = false;
  var foundIndex = 0;
  for (var y = 0; y < SubAsmArray[asmIndex].Components.length; ++y) {
    if (SubAsmArray[asmIndex].Components[y].Name == itemName) {
      SubAsmArray[asmIndex].Components[y].Count++;
      found = true;
      break;
    }
  }

  // If we didn't find an entry for this, add it at the end.
  if (found != true) {
    var nextItem = SubAsmArray[asmIndex].Components.length;
    SubAsmArray[asmIndex].Components[nextItem] = {
      Name: itemName,
      ElementId : partElementId,
      AsmElementId : asmElementId,
      Count: 1,
      PartNumber: 0,
      Revision: 1
    }
  }
}

function findComponents(resolve, reject, nextElement, asmIndex) {
  // Use the new API to pull component and sub-assembly info
  var topPath = "/api/models/assembly/definition/" + theContext.documentId + "/workspace/" + theContext.workspaceId + "/element/" + nextElement + "?includeMateFeatures=false";
  var topParams = {name:"generic", method:"GET", path: topPath};
  topParams.sessionID = sessionID;

  $.post("/proxy", topParams)
      .done(function(data) {
        var compData = JSON.parse(data);

        // Get the top-level components for this assembly ... gather a list of sub-assemblies to process as well
        for (var i = 0; i < compData.rootAssembly.instances.length; ++i) {
          if (compData.rootAssembly.instances[i].type == "Part") {
            var bracketIndex = compData.rootAssembly.instances[i].name.lastIndexOf("<");
            var itemName = compData.rootAssembly.instances[i].name;
            if (bracketIndex > -1)
              itemName = compData.rootAssembly.instances[i].name.substring(0, bracketIndex - 1);

            // Search through the list of components to find a match
            saveComponentToList(asmIndex, itemName, 0, compData.rootAssembly.instances[i].elementId);
          }
        }

        // Find out if any sub-assemblies are referenced and if so, bump the assembly reference count
        for (var z = 0; z < compData.subAssemblies.length; ++z) {
          var subElementId = compData.subAssemblies[z].elementId;
          var found = false;
          var asmName;
          for (var n = 0; n < SubAsmArray.length; ++n) {
            if (subElementId == SubAsmArray[n].Element) {
              SubAsmArray[n].Count++;
              found = true;
              asmName = SubAsmArray[n].Name;
              break;
            }
          }

          // Save this as a 'component' in the list too
          if (found == true)
            saveComponentToList(asmIndex, asmName, subElementId, 0);
        }

        resolve(asmIndex);
      })
      .fail(function(data) {
        reject("Error finding components for assembly");
      });
}

// Second half to the generate function ... need the bounding box results first
function onGenerate2() {
// Add an image of the model to the page
  ResultImage = $('<div style="float:right"></div>');
  ResultImage.addClass('ResultImage');

  var body = {
    "documentId": theContext.documentId,
    "elementId": theContext.elementId,
    "workspaceId": theContext.workspaceId,
    "viewMatrix": [0.707, 0.707, 0, -tX, -0.409, 0.409, 0.816, -tY, 0.577, -0.577, 0.577, -tZ],
    "outputHeight": 600,
    "outputWidth": 600,
    "pixelSize": realSize / 600
  }
  var callParams = {
    "name": "generic",
    "method": "POST",
    "path": "/api/drawings/shaded",
    "sessionID": sessionID,
    "body": JSON.stringify(body, null, 2)
  }

  var imageString = "";

  $.post("/proxy", callParams)
      .done(function (data) {
        try {
          var res = JSON.parse(data);
          if (res.images.length > 0) {
            var image = res.images[0];
            ResultImage.append("<img alt='shaded view' src='data:image/png;base64," + image + "' />");
          }
          else {
            imageString = "<img alt='An image' src='http://i.imgur.com/lEyLDtn.jpg' width=550 height=244 />";
            ResultImage.append(imageString);
          }
        }
        catch (err) {
        }
      })
      .fail(function () {
      });

// Create block dom

  this.block = $('<div class="block" position="relative"></div>');
  this.block.attr("bom", "bom")
  this.block.append(ResultImage);
  ResultTable = $('<table valign="center"></table>');
  ResultTable.addClass('resultTable');
  this.block.append(ResultTable);

  ResultTable.append("<th style='min-width:25px' align='left'> </th>");
  ResultTable.append("<th style='min-width:125px' align='left'>Item Number</th>");

  var e = document.getElementById("thumbs-generate");
  if (e.checked == true)
    ResultTable.append("<th style='min-width:75px' align='left'>Image</th>");

  ResultTable.append("<th style='min-width:200px' align='left'>Component Name</th>");
  ResultTable.append("<th style='min-width:100px' align='left'>Count</th>");
  ResultTable.append("<th style='min-width:150px' align='left'>Part Number</th>");
  ResultTable.append("<th style='min-width:100px' align='left'>Revision</th>");

//  $('#apis').append(this.title);
  $('#apis').append(this.block);

  // Recursive search for components in the assembly
  Comp2Array = [];
  SubAsmArray = [];
  ImagesArray = [];
  ThumbPromises = [];

  var addImage = false;
  var e = document.getElementById("thumbs-generate");
  if (e.checked == true)
    addImage = true;

  var getPromise = new Promise(findAssemblies);

  // Find all assemblies in the model
  return getPromise.then(function() {
    var listPromises = [];

    // Find all of the components in those assemblies
    for (var x = 0; x < SubAsmArray.length; ++x) {
      listPromises.push(new Promise(function(resolve, reject) { findComponents(resolve, reject, SubAsmArray[x].Element, x); }));
    }

    return Promise.all(listPromises);
  }).then(function() {
    var bboxPromises = [];

    if (addImage) {
      // Generate all of the thumbnails of the models
      for (var x = 0; x < SubAsmArray.length; ++x) {
        var thumbPromise = generateBBox(SubAsmArray[x].Element);
        bboxPromises.push(thumbPromise);
 //       for (var y = 0; y < SubAsmArray[x].Components.length; ++y) {
 //         if (SubAsmArray[x].Components[y].AsmElementId == 0) {
            // Generate the thumbnail for the parts too
 //           var nextThumbPromise = generateBBox(SubAsmArray[x].Components[y].ElementId);
 //          bboxPromises.push(nextThumbPromise);
 //         }
 //       }
      }
    }

    return Promise.all(bboxPromises);
  }).then(function() {
    // Make sure all of the images are captured
    return Promise.all(ThumbPromises);
  }).then(function() {
    // Match up revision/part number and total counts here
    onGenerate3();
  });

}

//
// From all of the assemblies, create a list of flattened components
//
function createFlattenedList() {
  // Create a flattened list of components
  for (var i = 0; i < SubAsmArray.length; ++i) {
    for (var x = 0; x < SubAsmArray[i].Components.length; ++x) {
      // Skip over any sub-assemblies in the list
      if (SubAsmArray[i].Components[x].AsmElementId != 0)
        continue;

      // Find out if this component exists in our flattened list yet
      var found = false;
      var countMultiplier = 1;
      if (SubAsmArray[i].Count > 1)
        countMultiplier = (SubAsmArray[i].Count - 1);

      for (var y = 0; y < Comp2Array.length; ++ y) {
        if (Comp2Array[y].Name == SubAsmArray[i].Components[x].Name) {
          Comp2Array[y].Count += countMultiplier * SubAsmArray[i].Components[x].Count;
          found = true;
          break;
        }
      }

      // Add this component to the list
      if (found == false) {
        Comp2Array[Comp2Array.length] = {
          Name : SubAsmArray[i].Components[x].Name,
          Count : countMultiplier * SubAsmArray[i].Components[x].Count,
          PartNumber : 0,
          Revision : 1,
          Level : 0,
          Collapse : false,
          ElementId : SubAsmArray[i].Components[x].ElementId,
          AsmElementId : 0
        }
      }
    }
  }
}

//
// Add a component to the master list
//
function addComponentToList(indexI, indexX, levelIn, forceAdd) {
  var found = false;

  if (forceAdd == false) {
    for (var y = 0; y < Comp2Array.length; ++y) {
      if (Comp2Array[y].Name == SubAsmArray[indexI].Components[indexX].Name) {
        Comp2Array[y].Count += SubAsmArray[indexI].Components[indexX].Count;
        found = true;
        break;
      }
    }
  }

  // Add this component to the list
  if (found == false) {
    Comp2Array[Comp2Array.length] = {
      Name : SubAsmArray[indexI].Components[indexX].Name,
      Count : SubAsmArray[indexI].Components[indexX].Count,
      PartNumber : 0,
      Revision : 1,
      Level : levelIn,
      Collapse : false,
      ElementId : SubAsmArray[indexI].Components[indexX].ElementId,
      AsmElementId : 0
    }
  }
}

//
// Add the Sub Assembly to the list with the proper count
// Then add all of the components for one instance of the sub-assembly
//
function addSubAssemblyToList(indexI, levelIn, recurse) {
  // Put on the sub-assembly with the collapse option as TRUE
  var asmCount = SubAsmArray[indexI].Count;
  if (recurse == true)
    asmCount = 1;
  Comp2Array[Comp2Array.length] = {
    Name : SubAsmArray[indexI].Name,
    Count : asmCount,
    PartNumber : 0,
    Revision : 1,
    Level : levelIn,
    Collapse : true,
    ElementId : 0,
    AsmElementId : SubAsmArray[indexI].Element
  }

  // Now go through and add all of the children components at Level 1
  for (var x = 0; x < SubAsmArray[indexI].Components.length; ++x) {
    if (SubAsmArray[indexI].Components[x].AsmElementId == 0)
      addComponentToList(indexI, x, levelIn + 1, true);
    else if (recurse == true) {
      // Add sub-assemblies to the tree
      for (var y = 1; y < SubAsmArray.length; ++y) {
        if (SubAsmArray[y].Element == SubAsmArray[indexI].Components[x].AsmElementId)
          addSubAssemblyToList(y, levelIn + 1, true);
      }
    }
  }
}

//
// From all of the assemblies, create a list of components by sub-assembly
//
function createLayeredList() {
  // Walk from the top-level assembly
  var currentLevel = 0;
  for (var i = 0; i < SubAsmArray.length; ++i) {
    if (i > 0) {
      // Add a sub-assembly to the master list ... note the first one is the top-level assembly
      addSubAssemblyToList(i, 0, false);
    }
    else {
      for (var x = 0; x < SubAsmArray[i].Components.length; ++x) {
        // Find out if this component exists in our flattened list yet
        if (SubAsmArray[i].Components[x].AsmElementId == 0)
          addComponentToList(i, x, currentLevel, false);
      }
    }
  }
}

//
// From all of the assemblies, create a list of components by sub-assembly
//
function createTreeList() {
  if (SubAsmArray.length == 0)
    return;

  // Walk from the top-level assembly
  var currentLevel = 0;
  for (var x = 0; x < SubAsmArray[0].Components.length; ++x) {
    // Find out if this component exists in our flattened list yet
    if (SubAsmArray[0].Components[x].AsmElementId == 0)
      addComponentToList(0, x, currentLevel, false);
    else {
      // Find the sub-assembly to add ...
      for (var y = 1; y < SubAsmArray.length; ++y) {
        if (SubAsmArray[y].Element == SubAsmArray[0].Components[x].AsmElementId)
          addSubAssemblyToList(y, currentLevel, true);
      }
    }
  }
}

function onGenerate3()
{
// Add all of the parts of the selected document to the table
  var path = "/api/parts/" + theContext.documentId + "/workspace/" + theContext.workspaceId;
  var params = {name:"generic", method:"GET", path: path};
  params.sessionID = sessionID;

  var isFlat = true;

  // Create a flattened list of components
  var e = document.getElementById("type-select");
  if (e.selectedIndex == 0)
    createFlattenedList();
  else if (e.selectedIndex == 1) {
    isFlat = false;
    createLayeredList();
  }
  else {
    isFlat = false;
    createTreeList();
  }

  // Check to see if we should add the images
  var addImage = false;
  var e = document.getElementById("thumbs-generate");
  if (e.checked == true)
    addImage = true;

  $.post("/proxy", params)
      .done(function( data ) {
        try {
          // Find all components of the assembly
          var obj = $.parseJSON(data);
          theContext.parts = obj;       // remember details to use in api calls later

          // Keep a count of repeated components
          var compArray = {};
          var compSize = 0;
          for (var i = 0; i < obj.length; ++i) {
            var itemName = obj[i].name;
            var partNumber = obj[i].partNumber;
            var revision = obj[i].revision;

            if (itemName.lastIndexOf("Surface") == -1) {
              // Search through the list of components to find a match
              var found = false;
              for (var x = 0; x < compSize; ++x){
                if (compArray[x].Name == itemName) {
                  compArray[x].Count++;
                  found = true;

                  if (partNumber != null)
                    compArray[x].PartNumber = partNumber;
                  if (revision != null)
                    compArray[x].Revision = revision;

                  // Found a match or a place to put this component, kick out of the search
                  if (isFlat)
                    break;
                }
              }

              // Update the master list of information with PartNumber/Revision
              for (x = 0; x < Comp2Array.length; ++x) {
                if (Comp2Array[x].Name == itemName) {
                  if (partNumber != null)
                    Comp2Array[x].PartNumber = partNumber;
                  if (revision != null)
                    Comp2Array[x].Revision = revision;

                  // Found a match or a place to put this component, kick out of the search
                  if (isFlat)
                    break;
                }
              }

              // If we didn't find an entry for this, add it at the end.
              if (found != true) {
                if (partNumber == null)
                  partNumber = "-";
                if (revision == null)
                  revision = "1.0";
                compArray[compSize] = {
                  Name : itemName,
                  Count : 1,
                  PartNumber : partNumber,
                  Revision : revision
                }
                compSize++;
              }
            }
          }

          // Now that our list is condensed (possibly), kick it out to the second version of the table
          var currentItemNumber = 0;
          var currentSubItemNumber = 0;
          for (i =0; i < Comp2Array.length; ++i) {
            if (Comp2Array[i].Count > 0) {
              var colorOverride = "";
              var level = Comp2Array[i].Level;
              if (Comp2Array[i].Collapse == true)
                level++;

              if(Comp2Array[i].Level > 0) {
                var rValue = 0xFFFFFF - (0x101010*Comp2Array[i].Level);
                colorOverride = rValue.toString(16);;
              }

              // Get the image to use
              var imageString = "";
              for (var im = 0; im < ImagesArray.length; ++im) {
                if (ImagesArray[im].Element == Comp2Array[i].AsmElementId ||
                    ImagesArray[im].Element == Comp2Array[i].ElementId) {
                  var image = ImagesArray[im].Image;
                  imageString = "<img alt='shaded view' src='data:image/png;base64," + image + "' />";
                  break;
                }
              }

              var totalImageString = "";
              if (addImage)
                totalImageString = "<td>" + imageString + "</td>";

              //  ResultTable.append("<tr></tr>");
              if (Comp2Array[i].Collapse == true) {
                ResultTable.append("<tr data-depth='"+ Comp2Array[i].Level + "' class='collapse level" + Comp2Array[i].Level + "' bgcolor='" + colorOverride + "'>" + "<td><span class='toggle collapse'></span></td><td>" + (currentItemNumber + 1) + "</td>" + totalImageString + "<td><b>" + Comp2Array[i].Name + "</b></td>" +
                "<td>" + Comp2Array[i].Count + "</td>" + "<td>" + Comp2Array[i].PartNumber + "</td>" +
                "<td>" + Comp2Array[i].Revision + "</td>" + "</tr>");
                currentSubItemNumber = 0;
                currentItemNumber++;
              }
              else if (Comp2Array[i].Level == 0) {
                ResultTable.append("<tr>" + "<td> </td><td>" + (currentItemNumber + 1) + "</td>" + totalImageString + "<td>" + Comp2Array[i].Name + "</td>" +
                "<td>" + Comp2Array[i].Count + "</td>" + "<td>" + Comp2Array[i].PartNumber + "</td>" +
                "<td>" + Comp2Array[i].Revision + "</td>" + "</tr>");
                currentItemNumber++;
              }
              else {
                ResultTable.append("<tr data-depth='" + Comp2Array[i].Level + "' class='collapse level" + Comp2Array[i].Level + "' bgcolor='" + colorOverride + "'>" + "<td> </td><td>" + (currentSubItemNumber + 1) + "</td>" + totalImageString + "<td>" + Comp2Array[i].Name + "</td>" +
                "<td>" + Comp2Array[i].Count + "</td>" + "<td>" + Comp2Array[i].PartNumber + "</td>" +
                "<td>" + Comp2Array[i].Revision + "</td>" + "</tr>");
                currentSubItemNumber++;
              }
            }
            // Once we hit a 0 count, that means we are done with our list
            else
              continue;
          }
        }
        catch (err) {
        }
      });


}

//
// Expand/Collapse code for the controls in the generated BOM table
//
$(function() {
  $('#apis').on('click', '.toggle', function () {
    //Gets all <tr>'s  of greater depth
    //below element in the table
    var findChildren = function (tr) {
      var depth = tr.data('depth');
      return tr.nextUntil($('tr').filter(function () {
        return $(this).data('depth') <= depth;
      }));
    };

    var el = $(this);
    var tr = el.closest('tr'); //Get <tr> parent of toggle button
    var children = findChildren(tr);

    //Remove already collapsed nodes from children so that we don't
    //make them visible.
    //(Confused? Remove this code and close Item 2, close Item 1
    //then open Item 1 again, then you will understand)
    var subnodes = children.filter('.expand');
    subnodes.each(function () {
      var subnode = $(this);
      var subnodeChildren = findChildren(subnode);
      children = children.not(subnodeChildren);
    });

    //Change icon and hide/show children
    if (tr.hasClass('collapse')) {
      tr.removeClass('collapse').addClass('expand');
      children.hide();
    } else {
      tr.removeClass('expand').addClass('collapse');
      children.show();
    }
    return children;
  });
});