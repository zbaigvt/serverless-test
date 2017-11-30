/**
 * Formats the response from Cognos Web Services
 */
module.exports = function(response){
  if (response.filterResultSet){
    var filterResult = response.filterResultSet.filterResult;
    // check if array
    var reportEl = filterResult[0].reportElement;
    // check if array
    var item = reportEl[0].page.body.item;
    // check for 'No Data Available'
    var NO_DATA_AVAILABLE = "No Data Available";
    if ('txt' in item[0]){
      if (item[0].txt.val === NO_DATA_AVAILABLE) {
        return {
          // headers: [],
          rows: [],
            error: NO_DATA_AVAILABLE
        };
      }
    }

    // check if array
    var columns = item[0].lst.colTitle.map(function(title){
      return title.item[0].txt.val;
    });
    // check if array
    var first_item = item[0];

    // ensure we get an array of a single or many items.
    var _groups = 'row' in first_item.lst.group ? [first_item.lst.group] : first_item.lst.group.grp;

    // flat map over nested arrays
    var rowValues = [];
    _groups.forEach(function(_group){
      // clean up the row values;
      var values = _group.row.map(function(row){
        return row.cell.map(function(cell_it){
          return cell_it.item[0].txt.val;
        });
      });
      rowValues = rowValues.concat(values);
    });

    // generate key,value of the resulting rows.
    var rows = [];
    rowValues.forEach(function(rowVal, idx){
      var row = {};
      columns.forEach(function(val, idx) {
        var key = columns[idx];
        row[key] = rowVal[idx];
      });
      rows.push(row);
    });

    var result = {
      headers: columns,
      rows: rows
    };
    return result;
  }
  return null;
};
