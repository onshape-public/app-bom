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

  // Hold onto the current session information
  theContext.documentId = theQuery.documentId;
  theContext.workspaceId = theQuery.workspaceId;
  theContext.elementId = theQuery.elementId;
  refreshContextElements();

});


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
      }
      theContext.elementId = $("#elt-select option:selected").val();
    }
  });
  return dfd.promise();
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

  // Get the bounding box size
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

      tX = xCenter * 0.707 + xCenter * -0.409 + xCenter * 0.577;
      tY = yCenter * 0.707 + yCenter * 0.409 + yCenter * -0.577;
      tZ = zCenter * 0 + zCenter * 0.816 + zCenter * 0.577;

      // Now, finish the rest of the work.
      onGenerate2();
    },
    error: function(data) {
      console.log("****** GET BOUNDING BOX - FAILURE - index.js");
    }
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
    $.ajax('/api/boundingBox' + '?documentId=' + theContext.documentId + '&workspaceId=' + theContext.workspaceId + '&elementId=' + elementId, {
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
      },
      error: function(data) {
        reject(1);
      }
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

    var options = "?documentId=" + theContext.documentId + "&workspaceId=" + theContext.workspaceId + "&elementId=" + elementId +
        "&outputHeight=50&outputWidth=50&pixelSize=" + realSize / 50 +
        "&viewMatrix1=" + 0.707 + "&viewMatrix2=" + 0.707 + "&viewMatrix3=" + 0 + "&viewMatrix4=" + xCtr +
        "&viewMatrix5=" + (-0.409) + "&viewMatrix6=" + 0.409 + "&viewMatrix7=" + 0.816 + "&viewMatrix8=" + yCtr +
        "&viewMatrix9=" + 0.577 + "&viewMatrix10=" + (-0.577) + "&viewMatrix11=" + 0.577 + "&viewMatrix12=" + zCtr;

    $.ajax('/api/shadedView'+ options, {
      dataType: 'json',
      type: 'GET',
      success: function(data) {
        var res = data;
        if (res.images.length > 0) {
          ImagesArray[ImagesArray.length] = {
            Image : res.images[0],
            Element : elementId
          }
        }
        resolve(1);
      },
      error: function() {
        reject(0);
      }
    });
  });

  ThumbPromises.push(thumb);
}

function findAssemblies(resolve, reject) {
  var params = "?documentId=" + theContext.documentId + "&workspaceId=" + theContext.workspaceId;

  $.ajax('/api/elements'+ params, {
    dataType: 'json',
    type: 'GET',
    success: function(data) {
      // for each element, create a select option to make that element the current context
      var obj = data;
      var id;
      for (var i = 0; i < obj.length; ++i) {
        if (obj[i].elementType == 'ASSEMBLY') {
          // Add this to the list of assemblies
          SubAsmArray[SubAsmArray.length] = {
            Element: obj[i].id,
            Count: 0,
            Handled: false,
            Name : obj[i].name,
            Components : []
          }
        }
      }

      resolve(SubAsmArray);
    },
    error: function() {
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
  $.ajax('/api/definition'+ window.location.search + '&nextElement=' + nextElement, {
    dataType: 'json',
    type: 'GET',
    success: function(data) {
      var compData = data;

      // Get the top-level components for this assembly ... gather a list of sub-assemblies to process as well
      for (var i = 0; i < compData.rootAssembly.instances.length; ++i) {

        // If it's a part, then add that to the list
        if (compData.rootAssembly.instances[i].type == "Part") {
          var bracketIndex = compData.rootAssembly.instances[i].name.lastIndexOf("<");
          var itemName = compData.rootAssembly.instances[i].name;
          if (bracketIndex > -1)
            itemName = compData.rootAssembly.instances[i].name.substring(0, bracketIndex - 1);

          // Search through the list of components to find a match
          saveComponentToList(asmIndex, itemName, 0, compData.rootAssembly.instances[i].elementId);
        }

        // If it's a sub-assembly instance, make sure we bump the count properly.
        else if (compData.rootAssembly.instances[i].type == "Assembly") {
            var subElementId = compData.rootAssembly.instances[i].elementId;
            var found = false;
            var asmName;
            for (var n = 0; n < SubAsmArray.length; ++n) {
              if (subElementId == SubAsmArray[n].Element) {
                found = true;
                asmName = SubAsmArray[n].Name;
                break;
              }
            }

            // Save this as a 'component' in the list too
            if (found == true)
              saveComponentToList(asmIndex, asmName, subElementId, 0);
        }
      }

      resolve(asmIndex);
    },
    error: function() {
      reject("Error finding components for assembly");
    }
  });
}

// Second half to the generate function ... need the bounding box results first
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

  ResultTable.append("<th style='min-width:25px' align='left'> </th>");
  ResultTable.append("<th style='min-width:125px' align='left'>Item Number</th>");

  var e = document.getElementById("thumbs-generate");
  if (e.checked == true)
    ResultTable.append("<th style='min-width:75px' align='left'>Image</th>");

  ResultTable.append("<th style='min-width:200px' align='left'>Component Name</th>");
  ResultTable.append("<th style='min-width:100px' align='left'>Count</th>");
  ResultTable.append("<th style='min-width:150px' align='left'>Part Number</th>");
  ResultTable.append("<th style='min-width:100px' align='left'>Revision</th>");

  $('#bomResults').append(this.block);

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

    // Find all of the components in the selected assembly (and it's sub-assemblies)
    for (var x = 0; x < SubAsmArray.length; ++x)
      listPromises.push(new Promise(function(resolve, reject) { findComponents(resolve, reject, SubAsmArray[x].Element, x); }));

    return Promise.all(listPromises);
  }).then(function() {
    var bboxPromises = [];

    if (addImage) {
      // Generate all of the thumbnails of the assemblies
      for (var x = 0; x < SubAsmArray.length; ++x) {
        var thumbPromise = generateBBox(SubAsmArray[x].Element);
        bboxPromises.push(thumbPromise);
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
function flattenSubAssembly(assemblyIndex) {
  // Make sure we are not processing sub-assemblies more than once
  if (SubAsmArray[assemblyIndex].Handled == true)
    return;
  SubAsmArray[assemblyIndex].Handled = true;

  // Create a flattened list of component
  for (var x = 0; x < SubAsmArray[assemblyIndex].Components.length; ++x) {
      // Skip over any sub-assemblies in the list
      if (SubAsmArray[assemblyIndex].Components[x].AsmElementId != 0) {
        // Find the index for that assembly info
        var subLevelAsmIndex = 0;
        for (var z = 0; z < SubAsmArray.length; ++z) {
          if (SubAsmArray[z].Element == SubAsmArray[assemblyIndex].Components[x].AsmElementId) {
            SubAsmArray[z].Count += SubAsmArray[assemblyIndex].Components[x].Count;
            subLevelAsmIndex = z;
            break;
          }
        }

        flattenSubAssembly(subLevelAsmIndex);
        continue;
      }

      // Find out if this component exists in our flattened list yet
      var found = false;
      var countMultiplier = 1;
      if (SubAsmArray[assemblyIndex].Count > 1)
        countMultiplier = SubAsmArray[assemblyIndex].Count;

      for (var y = 0; y < Comp2Array.length; ++ y) {
        if (Comp2Array[y].Name == SubAsmArray[assemblyIndex].Components[x].Name) {
          Comp2Array[y].Count += countMultiplier * SubAsmArray[assemblyIndex].Components[x].Count;
          found = true;
          break;
        }
      }

      // Add this component to the list
      if (found == false) {
        Comp2Array[Comp2Array.length] = {
          Name : SubAsmArray[assemblyIndex].Components[x].Name,
          Count : countMultiplier * SubAsmArray[assemblyIndex].Components[x].Count,
          PartNumber : 0,
          Revision : 1,
          Level : 0,
          Collapse : false,
          ElementId : SubAsmArray[assemblyIndex].Components[x].ElementId,
          AsmElementId : 0
        }
      }
    }
}

function createFlattenedList() {
  // Find the top level assembly to start with
  var topLevelAsmIndex = 0;
  for (var x = 0; x < SubAsmArray.length; ++x) {
    if (SubAsmArray[x].Element == theContext.elementId) {
      topLevelAsmIndex = x;
      break;
    }
  }

  // Start flattening from the top level assembly
  flattenSubAssembly(topLevelAsmIndex);
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
function addSubAssemblyToList(indexI, levelIn, countIn, recurse) {
  // Put on the sub-assembly with the collapse option as TRUE
  Comp2Array[Comp2Array.length] = {
    Name : SubAsmArray[indexI].Name,
    Count : countIn,
    PartNumber : 0,
    Revision : 1,
    Level : levelIn,
    Collapse : true,
    ElementId : 0,
    AsmElementId : SubAsmArray[indexI].Element
  }

  // Now go through and add all of the children components at Level +1 to this one
  for (var x = 0; x < SubAsmArray[indexI].Components.length; ++x) {
    if (SubAsmArray[indexI].Components[x].AsmElementId == 0)
      addComponentToList(indexI, x, levelIn + 1, true);
    else if (recurse == true) {
      // Add sub-assemblies to the tree
      for (var y = 0; y < SubAsmArray.length; ++y) {
        if (SubAsmArray[y].Element == SubAsmArray[indexI].Components[x].AsmElementId)
          addSubAssemblyToList(y, levelIn + 1, SubAsmArray[indexI].Components[x].Count, true);
      }
    }
  }
}

//
// From all of the assemblies, create a list of components by sub-assembly
//
function createTreeList() {
  // Find the top level assembly to start with
  var topLevelAsmIndex = 0;
  for (var x = 0; x < SubAsmArray.length; ++x) {
    if (SubAsmArray[x].Element == theContext.elementId) {
      topLevelAsmIndex = x;
      break;
    }
  }

  // Walk from the top-level assembly
  var currentLevel = 0;
  for (var x = 0; x < SubAsmArray[topLevelAsmIndex].Components.length; ++x) {
    // Find out if this component exists in our flattened list yet
    if (SubAsmArray[topLevelAsmIndex].Components[x].AsmElementId == 0)
      addComponentToList(topLevelAsmIndex, x, currentLevel, false);
    else {
      // Find the sub-assembly to add ...
      for (var y = 0; y < SubAsmArray.length; ++y) {
        if (SubAsmArray[y].Element == SubAsmArray[topLevelAsmIndex].Components[x].AsmElementId)
          addSubAssemblyToList(y, currentLevel, SubAsmArray[topLevelAsmIndex].Components[x].Count, true);
      }
    }
  }
}

function onGenerate3()
{
  var isFlat = true;

  // Create a flattened list of components
  var e = document.getElementById("type-select");
  if (e.selectedIndex == 0)
    createFlattenedList();
  else {
    isFlat = false;
    createTreeList();
  }

  // Check to see if we should add the images
  var addImage = false;
  var e = document.getElementById("thumbs-generate");
  if (e.checked == true)
    addImage = true;

  $.ajax('/api/elements'+ window.location.search, {
    dataType: 'json',
    type: 'GET',
    success: function(data) {
      // Find all components of the assembly
      var obj = data;

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
          for (var x = 0; x < compSize; ++x) {
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
              Name: itemName,
              Count: 1,
              PartNumber: partNumber,
              Revision: revision
            }
            compSize++;
          }
        }
      }

      // Now that our list is condensed (possibly), kick it out to the second version of the table
      var currentItemNumber = 0;
      var currentSubItemNumber = 0;
      for (i = 0; i < Comp2Array.length; ++i) {
        if (Comp2Array[i].Count > 0) {
          var colorOverride = "";
          var level = Comp2Array[i].Level;
          if (Comp2Array[i].Collapse == true)
            level++;

          if (Comp2Array[i].Level > 0) {
              var rValue = 0xFFFFFF - (0x101010 * Comp2Array[i].Level);
              colorOverride = rValue.toString(16);
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

          // ResultTable.append("<tr></tr>");
          if (Comp2Array[i].Collapse == true) {
            ResultTable.append("<tr data-depth='" + Comp2Array[i].Level + "' class='collapse level" + Comp2Array[i].Level + "' bgcolor='" + colorOverride + "'>" + "<td><span class='toggle collapse'></span></td><td>" + (currentItemNumber + 1) + "</td>" + totalImageString + "<td><b>" + Comp2Array[i].Name + "</b></td>" +
            "<td>" + Comp2Array[i].Count + "</td>" + "<td>" + Comp2Array[i].PartNumber + "</td>" +
            "<td>" + Comp2Array[i].Revision + "</td>" + "</tr>");
            currentSubItemNumber = 0;
            currentItemNumber++;
          }
          else if (Comp2Array[i].Level == 0) {
            ResultTable.append("<tr> data-depth='" + 0 + "' class='collapse level" + 0 + "><td> </td><td>" + (currentItemNumber + 1) + "</td>" + totalImageString + "<td>" + Comp2Array[i].Name + "</td>" +
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
    },
    error: function() {
    }
  });
}

//
// Expand/Collapse code for the controls in the generated BOM table
//
$(function() {
  $('#bomResults').on('click', '.toggle', function () {
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

    // Remove already collapsed nodes from children so that we don't
    // make them visible.
    // (Confused? Remove this code and close Item 2, close Item 1
    // then open Item 1 again, then you will understand)
    var subnodes = children.filter('.expand');
    subnodes.each(function () {
      var subnode = $(this);
      var subnodeChildren = findChildren(subnode);
      children = children.not(subnodeChildren);
    });

    // Change icon and hide/show children
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
