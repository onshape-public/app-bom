////////////////////////////////////////////////////////////////
// global data

var theContext = {};
var ResultTable;

////////////////////////////////////////////////////////////////
// startup
//
$(document).ready(function() {

  // retrieve the query params
  var theQuery = $.getQuery();

  // connect the button
  $("#element-generate").button().click(onGenerate);
  $("#element-save-csv").button().click(onSave);
  $("#element-print").button().click(onPrint);

  // Hold onto the current session information
  theContext.documentId = theQuery.documentId;
  theContext.workspaceId = theQuery.workspaceId;
  theContext.elementId = theQuery.elementId;
  theContext.verison = 0;
  theContext.microversion = 0;

  refreshContextElements(0);

  // Hide the UI elements we don't need right now
  uiDisplay('off', 'on');
});

// Send message to Onshape
function sendMessage(msgName) {
  var msg = {};
  msg['documentId'] = theContext.documentId;
  msg['workspaceId'] = theContext.workspaceId;
  msg['elementId'] =  theContext.elementId;
  msg['messageName'] = msgName;

  parent.postMessage(msg, '*');
}

//
// Check to see if a model has changed
function checkForChange(resolve, reject, elementId) {
  var params = "?documentId=" + theContext.documentId + "&workspaceId=" + theContext.workspaceId + "&elementId=" + elementId;

  $.ajax('/api/modelchange'+ params, {
    dataType: 'json',
    type: 'GET',
    success: function(data) {
      var objects = data;
      if (objects.change == true && Parts.length > 0) {
        // Show the message to say the BOM may be invalid
        var e = document.getElementById("element-model-change-message");
        e.style.display = "initial";
      }
      resolve(1);
    },
    error: function(data) {
      reject(0);
    }
  });
}

//
// Tab is now shown
function onShow() {
  var listPromises = [];
  var selectedIndex = 0;

  // Check to see if any of the assemblies have changed, if so, let the user know
  $('#elt-select option').each(function(index,element){
    listPromises.push(new Promise(function(resolve, reject) { checkForChange(resolve, reject, element.value); }));

    if (element.value == theContext.elementId)
      selectedIndex = index;
  });

  return Promise.all(listPromises).then(function() {
    // Update the assembly list ... it may have changed.
    refreshContextElements(selectedIndex);
  });
}

function onHide() {
  // our tab is hidden
  // take appropriate action
}

function handlePostMessage(e) {
  if (e.data.messageName === 'show') {
    onShow();
  } else if (e.data.messageName === 'hide') {
    onHide();
  }
};

// keep Onshape alive if we have an active user
var keepaliveCounter = 5 * 60 * 1000;   // 5 minutes
var timeLastKeepaliveSent;
// User activity detected. Send keepalive if we haven't recently
function keepAlive() {
  var now = new Date().getTime();
  if (now > timeLastKeepaliveSent + keepaliveCounter) {
    sendKeepalive();
  }
}

// Send a keepalive message to Onshape
function sendKeepalive() {
  sendMessage('keepAlive');
  timeLastKeepaliveSent = new Date().getTime();
}

// First message to Onshape tells the Onshape client we can accept messages
function onDomLoaded() {
  // listen for messages from Onshape client
  window.addEventListener('message', handlePostMessage, false);
  timeLastKeepaliveSent = 0;
  document.onmousemove = keepAlive;
  document.onkeypress = keepAlive;
  sendKeepalive();
  return false;
}

// When we are loaded, start the Onshape client messageing
document.addEventListener("DOMContentLoaded", onDomLoaded);

//
// Simple alert infrasturcture
function displayAlert(message) {
  $("#alert_template span").remove();
  $("#alert_template button").after('<span>' + message + '<br></span>');
  $('#alert_template').fadeIn('slow');
  $('#alert_template .close').click(function(ee) {
    $("#alert_template").hide();
    $("#alert_template span").hide();
  });
}

var Subscribed = true;

//
// Check to see if the user is subscribed to this application
function checkSubscription() {
  // Make sure the user is subscribed
  return new Promise(function(resolve, reject) {
    $.ajax('/api/accounts', {
      dataType: 'json',
      type: 'GET',
      success: function(data) {
        var object = data;

        Subscribed = object.Subscribed;

        // If there is no active subscription, then block the Create button.
        if (Subscribed == false) {
          displayAlert('No active subscription for this application. Check the Onshape App Store.');
          var b = document.getElementById("element-generate");
          b.disabled = true;

          reject(0);
        }
        else
          resolve(1);
      }
    });
  });
}

//
// Global DATA that we need to hold onto for the selected assembly
var AsmOccurences = [];
var AsmInstances = [];
var AsmParts = [];
var AsmSubAssemblies = [];

var Parts = [];
var SubAsmIds = [];

//
// Update the list of elements in the context object
//
function refreshContextElements(selectedIndexIn) {
  // First, get all of the workspaces ...
  var params = "?documentId=" + theContext.documentId;
  $.ajax('/api/workspace' + params, {
    dataType: 'json',
    type: 'GET',
    success: function (data) {
      var work = data;
      ReadOnly = false;
      theContext.microversion = 0;
      theContext.version = 0;

      // Find the current workspace in the list
      for (var i = 0; i < work.length; ++i) {
        if (work[i].id == theContext.workspaceId) {
          ReadOnly = work[i].isReadOnly;
          theContext.microversion = work[i].microversion;
          break;
        }
      }

      // Next, get all of the versions and cross-compare microversions to figure out the Version (we need that for Metadata retrieval)
      $.ajax('/api/versions' + params, {
        dataType: 'json',
        type: 'GET',
        success: function (data) {
          var versions = data;

          // Walk-through these and see if we have a match of microversions
          for (var i = 0; i < versions.length; ++i) {
            if (versions[i].microversion == theContext.microversion) {
              theContext.version = versions[i].id;
              break;
            }
          }

          var dfd = $.Deferred();
          // Get all elements for the document ... only send D/W
          var params = "?documentId=" + theContext.documentId + "&workspaceId=" + theContext.workspaceId;
          $.ajax('/api/assemblies'+ params, {
            dataType: 'json',
            type: 'GET',
            success: function(data) {
              // for each assembly tab, create a select option to make that
              // assembly the current context
              $("#elt-select").empty();

              var objects = data;
              var id;

              for (var i = 0; i < objects.length; ++i) {
                $("#elt-select")
                    .append(
                    "<option value='" + objects[i].id + "'" +
                    (i == selectedIndexIn ? " selected" : "") + ">" +
                    _.escape(objects[i].name) +  "</option>"
                )
                    .change(function () {
                      id = $("#elt-select option:selected").val();
                      theContext.elementId = id;

                      // Restore the UI back to initial create
                      uiDisplay('off', 'on');

                      var b = document.getElementById("element-generate");
                      b.style.display = "initial";
                      b.firstChild.data = "Create";
                      $('#image-results').empty();
                      $('#bom-results').empty();
                    });

                // Setup the webhook for model changes
                var params = "?documentId=" + theContext.documentId + "&workspaceId=" + theContext.workspaceId + "&elementId=" + objects[i].id;
                $.ajax('/api/webhooks' + params, {
                  dataType: 'json',
                  type: 'GET',
                  success: function(data) {
                  }
                });
              }
              theContext.elementId = $("#elt-select option:selected").val();

              // If it's empty, then put up a message in the drop-list
              if (objects.length == 0) {
                $("#elt-select").append("<option value='" + 0 + "'" + " disabled>* No assemblies in this document *</option>");
                var b = document.getElementById("element-generate");
                b.disabled = true;
              }
              else {
                var b = document.getElementById("element-generate");
                b.disabled = false;
              }

              checkSubscription();
            },
            error: function(data) {
              $("#elt-select").append("<option value='" + 0 + "'" + " disabled>* Could not access assemblies list in this document *</option>");
              var b = document.getElementById("element-generate");
              b.disabled = true;

              document.cookie = "TemporaryTestCookie=yes;";
              if(document.cookie.indexOf("TemporaryTestCookie=") == -1) {
                displayAlert('<pre><h4>Cookies for third party sites need to be enabled for this app to run</h4><br>    If you are using Safari, use <b>Preferences</b> -> <b>Privacy</b> then click on <b>Always allow</b><br>    Refresh this page and the BOM Sample will work properly.</pre>');
              }
            }
          });
          return dfd.promise();
        }
      });
    },
    error: function(data) {
      $("#elt-select").append("<option value='" + 0 + "'" + " disabled>* Could not access assemblies list in this document *</option>");
      var b = document.getElementById("element-generate");
      b.disabled = true;

      document.cookie = "TemporaryTestCookie=yes;";
      if(document.cookie.indexOf("TemporaryTestCookie=") == -1) {
        console.log("Third party cookie issue ...");
        displayAlert('Cookies for third party sites need to be enabled for this app to run<br>    If you are using Safari, use <b>Preferences</b> -> <b>Privacy</b> then click on <b>Always allow</b><br>    Refresh this page and the BOM Sample will work properly.');
      }
    }
  });
}

//
// Get the definition of the selected assembly
//
function findDefinition(resolve, reject) {
  $.ajax('/api/definition'+ window.location.search + '&nextElement=' + theContext.elementId, {
    dataType: 'json',
    type: 'GET',
    success: function(data) {
      var compData = data;

      // Save information here
      AsmOccurences = data.rootAssembly.occurrences;
      AsmInstances = data.rootAssembly.instances;
      AsmParts = data.parts;
      AsmSubAssemblies = data.subAssemblies;

      resolve(1);
    },
    error: function() {
      reject("Error finding components for assembly");
    }
  });
}

function fetchAssemblyBom(resolve, reject) {
  var params = "?documentId=" + theContext.documentId + "&workspaceId=" + theContext.workspaceId + "&elementId=" + theContext.elementId;
  $.ajax('/api/bom' + params, {
    dataType: 'json',
    type: 'GET',
    success: function(data) {
      resolve(data);
    },
    error: function() {
      reject("Error fetching Assembly BOM");
    }
  })
}

//
// Turn bits of the UI on/off
function uiDisplay(state, save) {
  var e = document.getElementById("type-select");
  e.style.display = "none";

  var sType = (save == 'on') ? 'initial' : 'none';
  var b = document.getElementById("element-generate");
  b.style.display = sType;

  var dType = (state == 'off') ? 'none' : 'initial';

  b = document.getElementById("element-save-csv");
  b.style.display = dType;

  b = document.getElementById("element-print");
  b.style.display = dType;

  b = document.getElementById("element-model-change-message");
  b.style.display = 'none';

  $("#options_panel").css("visibility", (save == 'on') ? "visible" : "hidden");
  $("#context-table").css("visibility", (save == 'on') ? "visible" : "hidden");
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
  // Make sure the application is subscribed
  var checkPromise = checkSubscription();

  return checkPromise.then(function() {
    // Destroy anything previously created ...
    $('#image-results').empty();
    $('#bom-results').empty();

    theContext.elementId = $("#elt-select option:selected").val();

    uiDisplay('off', 'off');

    // Display the wait cursor
    var opts = {
      lines: 13 // The number of lines to draw
      , length: 8 // The length of each line
      , width: 4 // The line thickness
      , radius: 10 // The radius of the inner circle
      , scale: 0.01 // Scales overall size of the spinner
      , corners: 0.1 // Corner roundness (0..1)
      , color: '#000' // #rgb or #rrggbb or array of colors
      , opacity: 0.25 // Opacity of the lines
      , rotate: 0 // The rotation offset
      , direction: 1 // 1: clockwise, -1: counterclockwise
      , speed: 1 // Rounds per second
      , trail: 60 // Afterglow percentage
      , fps: 20 // Frames per second when using setTimeout() as a fallback for CSS
      , zIndex: 2e9 // The z-index (defaults to 2000000000)
      , className: 'spinner' // The CSS class to assign to the spinner
      , top: '45%' // Top position relative to parent
      , left: '50%' // Left position relative to parent
      , shadow: false // Whether to render a shadow
      , hwaccel: false // Whether to use hardware acceleration
      , position: 'relative' // Element positioning
    }
    var target = document.getElementById('bom-status-bar')
//  var spinner = new Spinner(opts).spin(target);

    // Clear any old data
    AsmOccurences = [];
    AsmInstances = [];
    AsmParts = [];
    AsmSubAssemblies = [];

    Parts = [];


    // Get the bounding box size so we can position the thumbnail properly
    $.ajax('/api/boundingBox' + '?documentId=' + theContext.documentId + '&workspaceId=' + theContext.workspaceId + '&elementId=' + theContext.elementId, {
      dataType: 'json',
      type: 'GET',
      success: function(data) {
        var res = data;
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

        tX = (xCenter * 0.707 + yCenter * 0.707 + zCenter * 0);
        tY = (xCenter * -0.409 + yCenter * 0.409 + zCenter * 0.816);
        tZ = (xCenter * 0.577 + yCenter * -0.577 + zCenter * 0.577);

        // Now, finish the rest of the work.
        onGenerate2();
      },
      error: function(data) {
      }
    });
  });
}

// Find the metadata for a given part ... Revision, Part Number
function findStudioMetadata(resolve, reject, partStudio) {
  var uri = '';
  if (partStudio.externalDocumentId) {
    uri = '/api/externalstudiometadata' +
    "?documentId=" + partStudio.externalDocumentId +
    "&versionId=" + partStudio.externalDocumentVersion +
    "&elementId=" + partStudio.elementId +
    "&linkDocumentId=" + theContext.documentId
  } else {
    uri = '/api/studiometadata'+
    "?documentId=" + theContext.documentId +
    "&workspaceId=" + theContext.workspaceId +
    "&elementId=" + partStudio.elementId +
    "&microversionId=" + theContext.microversion
  }
  $.ajax(uri, {
    dataType: 'json',
    type: 'GET',
    success: function(data) {
      var metaParts = data;

      for (var x = 0; x < metaParts.length; ++x) {
        var partId = metaParts[x].partId;

        // Find the parts these match up to in the parts list
        for (var y = 0; y < Parts.length; ++y) {
          if (Parts[y].isUsed == false || Parts[y].hasMeta == true)
            continue;

          // Match?
          if (Parts[y].partId == partId && Parts[y].elementId == partStudio.elementId) {
            Parts[y].partnumber = metaParts[x].partNumber;
            if (Parts[y].partnumber == null)
              Parts[y].partnumber = "";
            Parts[y].revision = metaParts[x].revision;
            if (Parts[y].revision == null)
              Parts[y].revision = "";
            Parts[y].name = metaParts[x].name;
            if (Parts[y].name == null)
              Parts[y].name = "";
            Parts[y].hasMeta = true;

            break;
          }
        }
      }
      resolve(1);
    },
    error: function() {
      reject("Error finding metadata for partstudio");
    }
  });
}

//
// Second half to the generate function ... need the bounding box results first
//
function onGenerate2() {
// Add an image of the model to the page
  ResultImage = $('<div id="image-div" class="center-block"></div>');
  ResultImage.addClass('result-image');

  var outputSize = 600;

  var options = "?documentId=" + theContext.documentId + "&workspaceId=" + theContext.workspaceId + "&elementId=" + theContext.elementId +
      "&outputHeight=" + outputSize + "&outputWidth=" + outputSize + "&pixelSize=" + realSize / outputSize +
      "&viewMatrix1=" + 0.707 + "&viewMatrix2=" + 0.707 + "&viewMatrix3=" + 0 + "&viewMatrix4=" + (-tX) +
      "&viewMatrix5=" + (-0.409) + "&viewMatrix6=" + 0.409 + "&viewMatrix7=" + 0.816 + "&viewMatrix8=" + (-tY) +
      "&viewMatrix9=" + 0.577 + "&viewMatrix10=" + (-0.577) + "&viewMatrix11=" + 0.577 + "&viewMatrix12=" + (-tZ);

  $.ajax('/api/shadedView'+ options, {
    dataType: 'json',
    type: 'GET',
    success: function(data) {
      var res = data;
      if (res.images.length > 0) {
        var image = res.images[0];
        ResultImage.append("<img class='bom-image-border' alt='shaded view' src='data:image/png;base64," + image + "' />");
      }
      else {
        imageString = "<img class='bom-image-border' alt='Assembly image' src='http://i.imgur.com/lEyLDtn.jpg' />";
        ResultImage.append(imageString);
      }

      // Create block dom
      this.block = $('<div class="bom-table-block"></div>');
      this.block.attr("bom", "bom")
     // this.block.append(ResultImage);
      ResultTable = $('<table class="table-striped"></table>');
      ResultTable.addClass('resultTable');
      this.block.append(ResultTable);

      // Get the name of the assembly we are generating the BOM for
      var e = document.getElementById("elt-select");
      var asmName = e.options[e.selectedIndex].text;
      ResultTable.append("<caption>"+ asmName + "</caption>");
      ResultTable.append("<th align='center'>Item</th>");

      ResultTable.append("<th align='left'>Component name</th>");
      ResultTable.append("<th align='center'>Count</th>");
      ResultTable.append("<th align='left'>Part number</th>");
      ResultTable.append("<th align='left'>Revision</th>");

      $('.image-results').append(ResultImage);
      $('#bom-results').append(this.block);

      // Get the contents of the assembly
      // var getPromise = new Promise(findDefinition);

      var fetchPromise = new Promise(fetchAssemblyBom);

      return fetchPromise.then(function(response) {
        var i;
        var partsTableData = [];

        for (i = 0; i < response.bomTable.items.length; i++) {
          partsTableData.push({
            name: response.bomTable.items[i].name,
            count: response.bomTable.items[i].quantity,
            partnumber: response.bomTable.items[i].partNumber,
            revision: response.bomTable.items[i].revision,
            isUsed: true
          });
        }
        Parts = partsTableData;
        updateBomTableDisplay(partsTableData);
      });
    },
    error: function() {

    }
  });
}

function updateBomTableDisplay(tableItems) {
  // If we are collating by component name, run through the parts again looking for instances
  var b = document.getElementById('bom-component-collapse');
  if (b.checked == true) {
    for (var x = 0; x < tableItems.length; ++x) {
      // Skip collated parts
      if (tableItems[x].isUsed == false) {
        continue;
      }

      // Check against all other parts to see if this part is already in the list (check vs. PartId)
      for (var y = x + 1; y < tableItems.length; ++y) {
        if (tableItems[y].isUsed == false)
          continue;

        // See if this is the same part ... if so, bump the count
        // This is a different check ... it just compares the components by name
        if (tableItems[y].name == tableItems[x].name) {
          tableItems[x].count+= tableItems[y].count;
          tableItems[y].isUsed = false;

          // Copy over the part number and revision if the 'base' part does not have that info ... API may not have access to the shared properties
          if (tableItems[x].partnumber == '')
          tableItems[x].partnumber = tableItems[y].partnumber;
          if (tableItems[x].revision == '')
          tableItems[x].revision = tableItems[y].revision;
        }
      }
    }
  }

  // Ready to generate BOM
  var currentItemNumber = 0;
  var currentSubItemNumber = 0;
  for (var i = 0; i < tableItems.length; ++i) {
    if (tableItems[i].isUsed == false)
      continue;

    ResultTable.append("<tr>" + "<td align='center'>" + (currentSubItemNumber + 1) + "</td>" + "<td style='padding-left: 20px'>" + tableItems[i].name + "</td>" +
    "<td align='center'>" +tableItems[i].count + "</td>" + "<td style='padding-left: 20px'>" + tableItems[i].partnumber + "</td>" +
    "<td style='padding-left: 20px'>" + tableItems[i].revision + "</td>" + "</tr>");
    currentSubItemNumber++;
  }

  // We can now save this off in other formats (like CSV)
  uiDisplay('on', 'on');

  var b = document.getElementById("element-generate");
  b.firstChild.data = "Update";
}

//
// Save the data as a CSV file
//
function onSave() {
  // Walk back throught the data and write out CSV format
  var myCsv = "Item number,Component name,Count,Part number,Revision\n";

  var currentItemNumber = 0;
  for (var i = 0; i < Parts.length; ++i) {
    if (Parts[i].isUsed == true) {

      myCsv += (currentItemNumber + 1) + "," +
      Parts[i].name + "," +
      Parts[i].count + "," +
      Parts[i].partnumber + "," +
      Parts[i].revision + "\n";
      currentItemNumber++;
    }
  }

  var pom = document.createElement('a');
  pom.setAttribute('href', 'data:text/csv;charset=utf-8,' + encodeURIComponent(myCsv));

  var e = document.getElementById("elt-select");
  var asmName = e.options[e.selectedIndex].text;
  pom.setAttribute('download', asmName + ".csv");

  if (document.createEvent) {
    var event = document.createEvent('MouseEvents');
    event.initEvent('click', true, true);
    pom.dispatchEvent(event);
  }
  else {
    pom.click();
  }
}

//
// Call up the print dialog after hiding the UI ... the standard File, Print does not work for an iFrame
//
function onPrint() {

  // Hide the UI ...
  uiDisplay('off', 'off');

  window.print();

  // Put the UI back ...
  uiDisplay('on', 'on');
}

