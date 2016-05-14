// This report has been custom-built for ESPN by Mixpanel's client solutions team, 
// and is not warranted or maintained alongside the core Mixpanel product. 
// As the end-user, you are solely responsible for any bug fixes, feature updates, 
// and ongoing code changes or iterations.


// number of slots to show
var totalSlots = 15;
// number of days to analyze engagement predictions (for predicted vs. actual engagement graphs)
// currently last 4 weeks
var predictedDays = 28;

// initialize jql script variables
var engagementScript, basicTrafficScript, storyScript;

// set up dropdowns
var platformDropdown = {
  items: [
    {label: 'All', value: 'all'},
    {label: 'Desktop', value: 'desktop'},
    {label: 'Mobile', value: 'mobile'}
  ]
};
var editionDropdown = {
  items: [
    {label: 'All', value: 'all'},
  ]
}

// when document loads
$(document).ready(function() {
  // get edition names to populate applicable dropdown
  MP.api.query('api/2.0/events/properties/values', {
    event: 'Page View',
    name: 'Edition Name',
  }).done(function(results) {
    _.each(results, function(edition) {
      // add each edition name to dropdown
      editionDropdown.items.push({label: edition, value: edition});
    });
    // populate edition dropdown div
    $('#edition-dropdown').MPSelect(editionDropdown);
  });

  // populate platform dropdown div
  $('#platform-dropdown').MPSelect(platformDropdown);

  // when dropdowns are changed
  $('#platform-dropdown').on('change', function() {
    $('.loading').show();
    getAllData();
  });
  $('#edition-dropdown').on('change', function() {
    $('.loading').show();
    getAllData();
  });

  // set script variables (taken from html) after html has loaded
  engagementScript = $.trim($('#engagement').html());
  basicTrafficScript = $.trim($('#basic-traffic').html());
  storyScript = $.trim($('#current-story').html());
  
  // loop through # slots to add slot html
  for (var i = 1; i <= totalSlots; i++) {
    addSlot(i);
  }
  // populate dashboard
  $('.loading').show();
  getAllData();

});

function addSlot(num) {
  // add slot div with structure to report body
  $('<div class="card">' +
  '<div id="slot' + num + '" class="slot">' + 
  '<div class="slot-num">' + num + '</div>' +
  '<div class="engagement-stats">' +
  '<div class="views metric"><div class="label">Views</div></div>' + 
  '<div class="starts metric"><div class="label">Video Starts</div></div>' + 
  '<div class="shares metric"><div class="label">Shares</div></div>' +
  '</div>' + // end engagement-stats div
  '<div class="engage-reports"></div>' + 
  '<div class="sources"></div>' +
  '<div class="story-stats"></div>' +
  '<div class="story-title"></div>' + 
  '</div>' + // end slot div
  '</div>') // end card div
  .appendTo('#all-slots');
}

function getAllData() {
  // add functions for each jql to promise array, so they're only executed 
  var promises = [];
  promises.push(getCurrentStory());
  promises.push(getEngagement());
  promises.push(getBasicTraffic());
  Promise.all(promises).then(function(data) {
    populateSlots(data);
    $('.loading').hide();
  });
  // call this function again every 60 seconds
  setTimeout(getAllData, 60000);
}

function populateSlots(results) {
  // display results in each slot
  var stories = results[0][0];
  var engagements = results[1][0];
  var traffics = results[2][0];
  for (var i = 1; i <= totalSlots; i++) {
    if (stories[i]) {
      displayStory(i, stories[i]);
    }
    displayEngagement(i, engagements[i]);
    displayBasicTraffic(i, traffics[i]);
  }
  // display top posts by view/share
  generateTables(engagements, stories);
  // display overall engagement graph
  displayOverall(engagements);
}

function generateTables(engagements, stories) {
  var $byView = $('#top-by-view');
  var $byShare = $('#top-by-share');
  // initialize top post list for each event name
  var top = {
    'Page View': [],
    'Video Started': [],
    'Social Share': []
  };
  // loop through each slot to add values to the appropriate list
  $.each(engagements, function(slot) {
    if (engagements[slot].Counts) {
      // loop through each event name in a slot's event counts
      $.each(engagements[slot].Counts, function(eventName, values) {
        // add slot info to list
        top[eventName].push({
          slot: slot,
          story: stories[slot].story, // get story name from "stories" object
          last: values.last || 0,
          change: !values.last ? 0 : Math.round((values.now - values.last)/values.last*100) // calculate the change in the last hour
        });
      });
    }
  })
  configureTableData($byView, top['Page View'], 'Page Views');
  configureTableData($byShare, top['Social Share'], 'Social Shares');
}

function configureTableData(div, data, event) {
  // sort data by total event count
  data.sort(function(a, b) {
    return b.last - a.last;
  });
  // take top 10 event counts
  sortedTable = _.first(data, 10);
  // display table with top 10 posts
  displayTable(div, sortedTable, event);
}

function displayTable(div, tableArray, event) {
  var $tableDiv = div.find('.top-table');
  // reset table
  $tableDiv.empty();
  // add header
  var headerData = {
    slot: 'Slot',
    story: 'Story',
    last: event,
    change: 'Change in Last Hour'
  }
  addRow($tableDiv, headerData, 'header-row');
  // add row for each row of data in array
  _.each(tableArray, function(row) {
    addRow($tableDiv, row);
  })
}

function addRow(tableDiv, data, header) {
  // add header class if applicable
  header = header ? header : '';
  // add default value if change is undefined
  if (!data.change && data.change !== 0) { data.change = 'N/A'; }
  // only add percent sign if percentage exists
  var change = header || data.change == 'N/A' ? '' : '%';
  // add color styling to numbers based on positive/negative change
  var color = header ? '' : ' style="color: ' + colorFormat(data.change) + ';"';
  // add row to table
  $('<div class="row ' + header + '">' + 
    '<div class="cell">' + data.slot + '</div>' + 
    '<div class="cell">' + data.story + '</div>' + 
    '<div class="cell">' + data.last + '</div>' + 
    '<div class="cell"' + color + '>' + data.change + change + '</div>' + 
    '</div>').appendTo(tableDiv);
}

function getCurrentStory() {
  // collect variables
  var platform = $('#platform-dropdown').val();
  var edition = $('#edition-dropdown').val() == '' ? 'all' : $('#edition-dropdown').val();
  // call current story jql
  var storyParams = {
    max_slots: totalSlots,
    from_date: date_to_string(_.now()),
    to_date: date_to_string(_.now()),
    edition: edition,
    platform: platform
  }
  return MP.api.jql(storyScript, storyParams);
}

function getEngagement() {
  // collect variables
  var platform = $('#platform-dropdown').val();
  var edition = $('#edition-dropdown').val() == '' ? 'all' : $('#edition-dropdown').val();
  // call engagement jql
  var engagementParams = {
    from_date: date_to_string(_.now() - 1000*60*60*24*predictedDays),
    to_date: date_to_string(_.now()),
    edition: edition,
    platform: platform
  }
  return MP.api.jql(engagementScript, engagementParams);
}

function getBasicTraffic() {
  // collect variables
  var platform = $('#platform-dropdown').val();
  var edition = $('#edition-dropdown').val() == '' ? 'all' : $('#edition-dropdown').val();
  // call basic traffic jql
  var basicTrafficParams = {
    max_slots: totalSlots,
    from_date: date_to_string(_.now()),
    to_date: date_to_string(_.now()),
    edition: edition,
    platform: platform
  }
  return MP.api.jql(basicTrafficScript, basicTrafficParams);
}

function displayOverall(results) {
  // display overall engagement graph
  // remove div
  $('#overall-engagement').remove();
  // add empty div with structure
  $('<div id="overall-engagement" class="card">' +
    '<div class="overall-graph"></div>' +
    '</div>').appendTo($('#all-slots'));

  var overallResults = {};
  // for each slot, add current engagement score data for past x hours
  for (var i = 1; i <= totalSlots; i++) {
    overallResults[i] = results[i].Engagement.Actual;
  }
  // add line graph
  addEngageChart('line', '.overall-graph', 'engage-graph', '', 'OVERALL ENGAGEMENT', overallResults);
  $('.overall-graph .graph svg rect:nth-child(5)').attr('fill', '#ffffff');
}

function displayStory(slot, results) {
  var $slotDiv = $('#slot' + slot);
  var $storyDiv = $slotDiv.find('.story-stats');
  // replace story text with current story
  $slotDiv.find('.story-title').text(results.story);

  // reset story stats
  $storyDiv.find('.story-stat').remove();
  // add new story stats
  $('<div class="story-stat"><div class="time">' + results.slot_time_hr + 
    '<span class="time-label">H</span>' + results.slot_time_min + 
    '<span class="time-label">M</span></div>' + 
    '<div class="label">In Slot</div></div>' + 
    '<div class="story-stat"><div class="time">' + results.story_time_hr + 
    '<span class="time-label">H</span>' + results.story_time_min + 
    '<span class="time-label">M</span></div>' + 
    '<div class="label">Since Publish</div></div>')
  .appendTo($storyDiv);
}

function displayEngagement(slot, results) {
  var $slotDiv = $('#slot' + slot);
  var $engageMetrics = $slotDiv.find('.engagement-stats');
  // reset engagement stats
  $engageMetrics.find('.engage-metric').remove();
  // add new engagement stats
  $('<div class="engage-metric">' + nFormatter(results.Counts['Page View'].total) + '</div>').appendTo($engageMetrics.find('.views'));
  $('<div class="engage-metric">' + nFormatter(results.Counts['Video Started'].total) + '</div>').appendTo($engageMetrics.find('.starts'));
  $('<div class="engage-metric">' + nFormatter(results.Counts['Social Share'].total) + '</div>').appendTo($engageMetrics.find('.shares'));

  // add engagement data to slot in report
  var vsPredicted = numberFormatRound(results.Engagement.Actual.now - results.Engagement.Predicted.now);

  // format data
  _.each(results.Engagement, function(type) {
    delete type.now;
  })
  // add graph to slot in report
  addEngageChart('line', '#slot' + slot, 'engage-graph', vsPredicted, 'VS. PREDICTED', results.Engagement);
}

function findKey(obj, value){
    var key;

    _.each(_.keys(obj), function(k){
      var v = obj[k];
      if (v === value){
        key = k;
      }
    });

    return key;
}

function displayBasicTraffic(slot, data) {
  var $slotDiv = $('#slot' + slot);
  // reset div
  var $sourceDiv = $slotDiv.find('.sources').empty();
  // add label
  $('<div class="chart-title">Traffic Sources</div>').appendTo($sourceDiv);
  // calculate total views for percentage breakdown
  var total = 0;
  _.each(data, function(count) {
    total += count;
  });

  // sort data
  var sortedData = [];
  _.each(data, function(value, key) {
    sortedData.push({
      label: key,
      count: value
    });
  });
  sortedData.sort(function(a, b) {
    return b.count - a.count;
  });

  // add segments to slot
  var $segments = $('<div class="segments"></div>').appendTo($sourceDiv);
  _.each(sortedData, function(source) {
    var label = source.label;
    var count = source.count;
    $('<div class="traffic-segment"><div class="label traffic-label">' + label + '</div>' + 
      '<div class="value">' + (count/total*100).toFixed() + '%</div></div>' + // percent of total views with this source
      '</div>').appendTo($segments);
  });
}

function date_to_string(d) {
  // format date in '2016-05-01' format (for jql query input)
  var timezone = 4; // utc to et offset (4 during dst, 5 otherwise)
  d -= 1000*60*60*timezone;
  return new Date(d).toISOString().split('T')[0];
}
function colorFormat(n) {
  // style numbers as green if positive, red if negative, black otherwise
  return n > 0 ? '#22ca76' : n < 0 ? '#ca2222' : 'black';
}
function numberFormatRound(n) {
  // round number
  return Math.round(n);
}
function nFormatter(num) {
  // format larger numbers such that millions are formatted as 3.1M, thousands as 138.4K, etc.
  if (num >= 1000000000) {
    return (num / 1000000000).toFixed(1).replace(/\.0$/, '') + 'G';
  }
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  }
  return num;
}
function numberFormatCommas(n) {
  // format large numbers to include commas to separate thousands, millions, etc.
  var parts = n.toString().split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return parts.join(".");
}

function addEngageChart(type, div, divName, number, title, data) {
  // add chart of type line, bar, or pie (all of which supported by Mixpanel ReportKit library) to specific div
  // determine graph div to add graph to
  var overall = title == 'OVERALL ENGAGEMENT';
  var $parentGraphDiv = overall ? $(div) : $(div).find('.engage-reports');
  // set up highcharts options
  // see http://api.highcharts.com/highcharts for options
  var highcharts = {
      colors: ['#2276ca', '#ca2222'],
      chart: {
          marginBottom: 30,
          borderWidth: 0,
          borderRadius: 0,
      },
      xAxis: {
          labels: {
              style: {
                'fontWeight': 'bold',
              },
          },
      },
      yAxis: {
          gridLineColor: '#E6E8EB',
          gridLineDashStyle: 'Dash',
          gridLineWidth: 1,
          labels: {
              style: {
                'fontWeight': 'bold',
              },
          },
      },
  }
  
  // set up graph params; dependent on type of graph
  var params;
  if (type == 'bar') {
    params = {
      chartType: type,
      stacked: true,
      highchartsOptions: highcharts,
      data: data
    }
  } else if (type == 'line') {
    params = {
      chartType: type,
      highchartsOptions: highcharts,
      data: data
    }
  } else if (type == 'pie') {
    // extend highcharts options in case of pie chart
    $.extend(highcharts, {
      plotOptions: {
        pie: {
          dataLabels: {
            distance: -30,
            color: '#ffffff',
            style: {
              'fontSize': '12px',
              'fontWeight': 'bold',
            },
          },
        }
      }
    })
    params = {
      chartType: type,
      highchartsOptions: highcharts,
      data: data
    }
  }
  
  // reset graphs
  $parentGraphDiv.find('.graph-container').remove();
  // add new graph container with extra classes if needed
  var $graphDiv = $('<div class="graph-container ' + overall + '"></div>').appendTo($parentGraphDiv);
  $('<div class="chart-header ' + overall + '">' + 
    '<div class="chart-title-shadow ' + overall + '"></div>' + 
    '<div class="chart-title-container">' + 
    '<div class="chart-title"><span style="color: ' + colorFormat(number) + '">' + numberFormatCommas(number) + '</span> ' + title + '</div>' +
    '</div>' + // end chart-title-container div
    '</div>') // end chart-header div
    .appendTo($graphDiv);
  // add actual graph div with extra classes if needed, initialize MPChart in div with defined params
  $('<div class="mp-graph ' + divName + '"></div>').appendTo($graphDiv).MPChart(params);
  // hide default chart header (because we added a custom one)
  $('.' + divName + ' .mixpanel-platform-chart_header').hide();
}
