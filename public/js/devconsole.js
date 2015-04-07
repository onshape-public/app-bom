
////////////////////////////////////////////////////////////////
// global data

var theQuery;
var theSession = null;
var theContext = {};
var firstTime = true;
var sessionID = "";
var ResultTable;

////////////////////////////////////////////////////////////////
// startup
//
$(document).ready(function() {

  // set globals
  theQuery = $.getQuery();

  newLogin();
  initHeader();
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

function newLogin(loginData) {


  theContext.documentId = theQuery.documentId;
  theContext.workspaceId = theQuery.workspaceId;
  theContext.elementId = theQuery.elementId;
  theContext.partId = "";
  theContext.parts = [];
  theContext.selectedPart = -1;

  // Send initial message to let Onshape know we're listening
  clientSendKeepalive();
}

function failedLogin() {

  $("#theUser").text("Not logged in");
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
      newLogin('User ' + p.user + ' is logged in right now!!');
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
            $("#elt-select")
                .append(
                        "<option value='" + obj[i].elementId + "'" +
                        (i==0 ? " selected" : "") +
                        ">" +
                        obj[i].name + "</option>"
                )
                .change(function() {
                  id = $("#elt-select option:selected").val();
                  theContext.elementId = id;
                  $("#elt-id").text(id);
                  }
                );
          }
          theContext.elementId = $("#elt-select option:selected").val();
         // $("#elt-id").text(theContext.elementId);
        }
        catch (err) {
          alert("Problem setting element list");
        }
  })
      .fail(function() {
          alert("Failed to set element list in Context Elements");
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
    alert("Failed to set element list in Context Parts");
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
//
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


/////////////////////////////////////
//
// Primary BOM generation function
//
function onGenerate() {
// Add all of the parts of the selected document to the table
  var path = "/api/parts/" + theContext.documentId + "/workspace/" + theContext.workspaceId;
  var params = {name:"generic", method:"GET", path: path};
  params.sessionID = sessionID;

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
            if (itemName.lastIndexOf("Surface") == -1) {
              // Search through the list of components to find a match
              var found = false;
              for (var x = 0; x < compSize; ++x){
                if (compArray[x].Count == 0 || compArray[x].Name == itemName) {
                  compArray[x].Count++;
                  found = true;

                  // Found a match or a place to put this component, kick out of the search
                  break;
                }
              }

              // If we didn't find an entry for this, add it at the end.
              if (found != true) {
                compArray[compSize] = {
                  Name : itemName,
                  Count : 1
                }
                compSize++;
              }
            }
          }

          // Now that our list is condensed (possibly), kick it out to the table
          for (i =0; i< compSize; ++i) {
            if (compArray[i].Count > 0) {
            //  ResultTable.append("<tr></tr>");
              ResultTable.append("<tr>" + "<td>" + (i+1) + "</td>" + "<td>" + compArray[i].Name + "</td>" + "<td>" + compArray[i].Count + "</td>" + "<td>" + " " + "</td>" + "</tr>");
            }
            // Once we hit a 0 count, that means we are done with our list
            else
              break;
          }
        }
        catch (err) {
          alert("Problem setting element list");
        }
      });
}

/////////////////////////////////////
//
// Setup the top of the BOM table
//
function initCategoryTab() {
  this.title = $('<div class="title">' + "" + '</div>');
  this.title.append("<center><strong>Bill of Materials</strong></center>");
  this.title.attr("bom", "bom");

  // create block dom
  this.block = $('<div class="block"></div>');
  this.block.attr("bom", "bom")
  ResultTable = $('<table></table>');
  ResultTable.addClass('resultTable');
  this.block.append(ResultTable);

  ResultTable.append("<td><strong>Item Number</strong></td>td>");
  ResultTable.append("<td><strong>Component Name</strong></td>");
  ResultTable.append("<td><strong>Count</strong></td>");
  ResultTable.append("<td><strong>Notes</strong></td><br>");


  $('#apis').append(this.title);
  $('#apis').append(this.block);
}
