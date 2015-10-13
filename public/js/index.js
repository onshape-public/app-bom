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
  refreshContextElements();

  // Hide the UI elements we don't need right now
  var e = document.getElementById("type-select");
  e.style.display = "none";

  var b = document.getElementById("element-save-csv");
  b.style.display = "none";

  var p = document.getElementById("element-print");
  p.style.display = "none";

  var c = document.getElementById("element-model-change-message");
  c.style.display = "none";
});

//
// DATA that we need to hold onto for the selected assembly
var AsmOccurences = [];
var AsmInstances = [];
var AsmParts = [];
var AsmSubAssemblies = [];

var Parts = [];
var SubAsmIds = [];

//
// Setup a timer to poll BOM server if an update was made to the model
var IntervalId = window.setInterval( function(){
  console.log("** Check for Event - Model Changed");

  var params = "?documentId=" + theContext.documentId + "&workspaceId=" + theContext.workspaceId + "&elementId=" + theContext.elementId;

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

      console.log("**   Check responded with " + objects.change);
    },
    error: function(data) {
      console.log("**   Check failed " + data.change);
    }
  });
}, 10000 );

// update the list of elements in the context object
function refreshContextElements() {
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
                    (i == 0 ? " selected" : "") + ">" +
                    objects[i].name + "</option>"
                   )
            .change(function () {
              id = $("#elt-select option:selected").val();
              theContext.elementId = id;
              });

        // Setup the webhook for model changes
        var params = "?documentId=" + theContext.documentId + "&workspaceId=" + theContext.workspaceId + "&elementId=" + objects[i].id;
        $.ajax('/api/webhooks' + params, {
          dataType: 'json',
          type: 'GET',
          success: function(data) {
            console.log("*** SUCCESS for webhook ");
          }
        });
      }
      theContext.elementId = $("#elt-select option:selected").val();
    }
  });
  return dfd.promise();
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
  $('#bomResults').empty();

  theContext.elementId = $("#elt-select option:selected").val();

  var b = document.getElementById("element-save-csv");
  b.style.display = "none";

  b = document.getElementById("element-print");
  b.style.display = "none";

  b = document.getElementById("element-model-change-message");
  b.style.display = "none";

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
}

//
// Find the metadata for a given part ... Revision, Part Number
function findMetadata(resolve, reject, index, elementId, partId) {
  $.ajax('/api/metadata'+
         "?documentId=" + theContext.documentId +
         "&workspaceId=" + theContext.workspaceId +
         "&elementId=" + elementId +
         "&partId=" + partId, {
    dataType: 'json',
    type: 'GET',
    success: function(data) {
      var compData = data;

      Parts[index].name = compData.name;
      Parts[index].partnumber = compData.partNumber;
      if (Parts[index].partnumber == null)
        Parts[index].partnumber = "";
      Parts[index].revision = compData.revision;
      if (Parts[index].revision == null)
        Parts[index].revision = "";

      resolve(1);
    },
    error: function() {
      reject("Error finding metadata for part");
    }
  });
}

//
// Second half to the generate function ... need the bounding box results first
//
function onGenerate2() {
// Add an image of the model to the page
  ResultImage = $('<div style="float:right"></div>');
  ResultImage.addClass('ResultImage');

  var options = "?documentId=" + theContext.documentId + "&workspaceId=" + theContext.workspaceId + "&elementId=" + theContext.elementId +
          "&outputHeight=600&outputWidth=600&pixelSize=" + realSize / 600 +
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
        ResultImage.append("<img alt='shaded view' src='data:image/png;base64," + image + "' />");
      }
      else {
        imageString = "<img alt='An image' src='http://i.imgur.com/lEyLDtn.jpg' width=550 height=244 />";
        ResultImage.append(imageString);
      }
    },
    error: function() {

    }
  });

// Create block dom
  this.block = $('<div class="block" position="relative"></div>');
  this.block.attr("bom", "bom")
  this.block.append(ResultImage);
  ResultTable = $('<table valign="center"></table>');
  ResultTable.addClass('resultTable');
  this.block.append(ResultTable);

  // Get the name of the assembly we are generating the BOM for
  var e = document.getElementById("elt-select");
  var asmName = e.options[e.selectedIndex].text;
  ResultTable.append("<caption>"+ asmName + "</caption>");
  ResultTable.append("<th style='min-width:25px' align='left'> </th>");
  ResultTable.append("<th style='min-width:125px' align='center'>Item Number</th>");

  ResultTable.append("<th style='min-width:200px' align='left'>Component Name</th>");
  ResultTable.append("<th style='min-width:100px' align='center'>Count</th>");
  ResultTable.append("<th style='min-width:150px' align='center'>Part Number</th>");
  ResultTable.append("<th style='min-width:100px' align='center'>Revision</th>");

  $('#bomResults').append(this.block);

  // Get the contents of the assembly
  var getPromise = new Promise(findDefinition);

  // Find all assemblies in the model
  return getPromise.then(function() {
    // Match up revision/part number and total counts here
    onGenerate3();
  });

}

//
// Primary worker function to create the flattened parts list and generate HTML
//
function onGenerate3() {
  Parts = [];
  SubAsmIds = [];

  // Create the list of sub-assemblies ... need to check two different lists
  for (var x = 0; x < AsmInstances.length; ++ x) {
    if (AsmInstances[x].type == "Assembly") {
      var foundId = false;
      for (var y = 0; y < SubAsmIds.length; ++y) {
        if (SubAsmIds[y].elementId == AsmInstances[x].id) {
          foundId = true;
          break;
        }
      }

      if (foundId == false)
        SubAsmIds[SubAsmIds.length] = { "elementId" : AsmInstances[x].elementId, "bbox" : 0, "id" : AsmInstances[x].id };
    }
  }

  for (var w = 0; w < AsmSubAssemblies.length; ++ w) {
    for (var z = 0; z < AsmSubAssemblies[w].instances.length; ++z) {
      if (AsmSubAssemblies[w].instances[z].type == "Assembly") {
        var foundSub = false;
        for (var a = 0; a < SubAsmIds.length; ++a) {
          if (SubAsmIds[a].elementId == AsmSubAssemblies[w].instances[z].id) {
            foundSub = true;
            break;
          }
        }

        if (foundSub == false)
          SubAsmIds[SubAsmIds.length] = { "elementId" : AsmSubAssemblies[w].instances[z].elementId, "bbox" : 0, "id" : AsmSubAssemblies[w].instances[z].id  };
      }
    }
  }

  // Create an a scratch list of parts from the occurrences ... i.e. stripping out the sub-assemblies
  for (var b = 0; b < AsmOccurences.length; ++b) {
    var lastPath = AsmOccurences[b].path[AsmOccurences[b].path.length-1];
    var parentPath = "";
    if (AsmOccurences[b].path.length > 1)
      parentPath = AsmOccurences[b].path[AsmOccurences[b].path.length-2];

    var transform = AsmOccurences[b].transform;
    var index = b;

    // Make sure this is a part (won't be on the sub assembly list we just built)
    var found = false;
    for (var c = 0; c < SubAsmIds.length; ++c) {
      if (SubAsmIds[c].id == lastPath) {
        found = true;
        break;
      }
    }

    if (found == true)
      continue;

    // Add this part to the list of parts to explode
    Parts[Parts.length] = {
      "id" : lastPath,
      "parentId" : parentPath,
      "index" : index,
      "elementId" : 0,
      "partId" : 0,
      "microversionId" : 0,
      "name" : 0,
      "partnumber" : 0,
      "revision" : 0,
      "isUsed" : true,
      "count" : 1
    };
  }

  // Find each Part's elementId and partId and match to its bbox
  for (var d = 0; d < AsmSubAssemblies.length; ++ d) {
    for (var e = 0; e < AsmSubAssemblies[d].instances.length; ++e) {
      if (AsmSubAssemblies[d].instances[e].type == "Part") {
        // See if this id matches any of the ones in the parts list
        for (var f = 0; f < Parts.length; ++f) {
          if (Parts[f].id == AsmSubAssemblies[d].instances[e].id) {
            Parts[f].elementId = AsmSubAssemblies[d].instances[e].elementId;
            Parts[f].partId = AsmSubAssemblies[d].instances[e].partId;
            Parts[f].microversionId = AsmSubAssemblies[d].instances[e].documentMicroversion;
          }
        }
      }
    }
  }

  for (var i = 0; i < AsmInstances.length; ++i) {
    if (AsmInstances[i].type == "Part") {
      // Do we have a match on the id?
      for (var j = 0; j < Parts.length; ++ j) {
        if (Parts[j].id == AsmInstances[i].id) {
          Parts[j].elementId = AsmInstances[i].elementId;
          Parts[j].partId = AsmInstances[i].partId;
          Parts[j].microversionId = AsmInstances[i].documentMicroversion;
        }
      }
    }
  }

  // Next, look to combine Parts
  var isFlat = true;
  for (var x = 0; x < Parts.length; ++x) {
    // Eliminate invalid parts
    if (Parts[x].partId == "") {
      Parts[x].isUsed = false;
      continue;
    }

    // Check against all other parts to see if this part is already in the list (check vs. PartId)
    if (Parts[x].isUsed == true) {
       for (var y = x + 1; y < Parts.length; ++y) {
        if (Parts[y].isUsed == false)
          continue;

        // See if this is the same part ... if so, bump the count
        if (Parts[y].partId == Parts[x].partId && Parts[y].elementId == Parts[x].elementId) {
          Parts[x].count++;
          Parts[y].isUsed = false;
        }
      }
    }
  }

// Now that we have the list of components ... go get the Metadata for each one
  var listPromises = [];

  for (x = 0; x < Parts.length; ++x) {
    if (Parts[x].isUsed == false)
      continue;
    listPromises.push(new Promise(function(resolve, reject) { findMetadata(resolve, reject, x, Parts[x].elementId, Parts[x].partId); }));
  }

  return Promise.all(listPromises).then(function() {
    // Ready to generate BOM
    var currentItemNumber = 0;
    var currentSubItemNumber = 0;
    for (var i = 0; i < Parts.length; ++i) {
      if (Parts[i].isUsed == false)
        continue;

      ResultTable.append("<tr>" + "<td> </td><td align='center'>" + (currentSubItemNumber + 1) + "</td>" + "<td>" + Parts[i].name + "</td>" +
          "<td align='center'>" + Parts[i].count + "</td>" + "<td align='center'>" + Parts[i].partnumber + "</td>" +
          "<td align='center'>" + Parts[i].revision + "</td>" + "</tr>");
          currentSubItemNumber++;
    }

    // We can now save this off in other formats (like CSV)
    var b = document.getElementById("element-save-csv");
    b.style.display = "initial";
    var p = document.getElementById("element-print");
    p.style.display = "initial";
  });
}

//
// Save the data as a CSV file
//
function onSave() {
  // Walk back throught the data and write out CSV format
  var myCsv = "Item Number,Component Name,Count,Part Number,Revision\n";

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
  var b = document.getElementById("element-save-csv");
  b.style.display = "none";

  b = document.getElementById("element-print");
  b.style.display = "none";

  b = document.getElementById("element-generate");
  b.style.display = "none";

  b = document.getElementById("elt-select");
  b.style.display = "none";

   window.print();

  // Put the UI back ...
  b = document.getElementById("element-save-csv");
  b.style.display = "initial";

  b = document.getElementById("element-print");
  b.style.display = "initial";

  b = document.getElementById("element-generate");
  b.style.display = "initial";

  b = document.getElementById("elt-select");
  b.style.display = "initial";
}

