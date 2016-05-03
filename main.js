// why is everything in basic traffic direct
// how to get only today? (only relevant hours)
  //fix hard-coded dates / dates in general
  // 12 comes before 9... alphabetically when 9 10 11 12 (need to order object)
// second page & high level metrics at top?
// legends for graphs or make it more obvious
// have a big red/green up or down arrow with percentage change over last hour?
// add story category? as tag colors

// number of slots to show
var totalSlots = 5;
// number of days to analyze engagement predictions
// currently last 4 weeks
var predictedDays = 28;

// cq scripts
var engagementScript, trafficScript, basicTrafficScript, storyScript;
$(document).ready(function() {
  engagementScript = $.trim($('#engagement').html());
  basicTrafficScript = $.trim($('#basic-traffic').html());
  storyScript = $.trim($('#current-story').html());
  
  // loop through slots
  for (var i = 1; i <= totalSlots; i++) {
    addSlot(i);
  }
  getAllData();
});

// add slot info to report
function addSlot(num) {
  // add slot div with structure
  $('<div class="card">' +
  '<div id="slot' + num + '" class="slot">' + 
  '<div class="slot-num">' + num + '</div>' +
  '<div class="engagement-stats">' +
  '<div class="views metric"><div class="label">Views</div></div>' + 
  '<div class="starts metric"><div class="label">Video Starts</div></div>' + 
  '<div class="shares metric"><div class="label">Shares</div></div>' +
  '</div>' + // engagement stats
  '<div class="engage-reports"></div>' + 
  '<div class="sources"></div>' +
  '<div class="story-stats"></div>' +
  '<div class="story-title"></div>' + 
  '</div>' + // slot
  '</div>')
  .appendTo('#all-slots');
}

function getAllData() {
  window.allData = [];
  var promises = [];
  promises.push(getCurrentStory());
  promises.push(getEngagement());
  promises.push(getBasicTraffic());
  Promise.all(promises).then(function(data) {
    populateSlots(data);
  });
  setTimeout(getAllData, 60000);
}

function populateSlots(results) {
  var d = new Date();
  var min = d.getMinutes() < 10 ? '0' + d.getMinutes() : d.getMinutes();
  var currentTime = d.getHours() % 12 || 12 + ':' + min;
  $('.current-time').text(currentTime);

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
  generateTables(engagements, stories);
  displayOverall(engagements);
}

function generateTables(engagements, stories) {
  console.log(stories);
  var $byView = $('#top-by-view');
  var $byShare = $('#top-by-share');
  var top = {
    'Page View': [],
    'Video Started': [],
    'Social Share': []
  };
  _.each(top, function(eventName, list) {
    for (var j = 0; j < 10; j++) {
      eventName.push({
        total: 0
      })
    }
  });
  $.each(engagements, function(slot) {
    if (engagements[slot].Counts) {
      $.each(engagements[slot].Counts, function(eventName, values) {
        for (var i = 0; i < top[eventName].length; i++) {
          var obj = top[eventName][i];
          if (values.total > obj.total) {
            console.log(slot);
            console.log(i);
            top[eventName][i] = {
              slot: slot,
              story: stories[slot].story,
              total: values.total,
              change: Math.round((values.now - values.last)/values.last*100)
            }
            return;
          }
        }
      });
    }
  })
  configureTableData($byView, top['Video Started'], 'Video Starts');
  configureTableData($byShare, top['Social Share'], 'Social Shares');
}

function configureTableData(div, data, event) {
  var unsorted = _.pluck(data, 'total');
  var sorted = unsorted.sort();
  var sortedTable = [];
  _.each(sorted, function(value) {
    var index = unsorted.indexOf(value);
    sortedTable.push(data[index]);
  })
  displayTable(div, sortedTable, event);
}

function displayTable(div, tableArray, event) {
  var $tableDiv = div.find('.top-table');
  $tableDiv.empty();
  var headerData = {
    slot: 'Slot',
    story: 'Story',
    total: 'Total ' + event,
    change: 'Change in Last Hour'
  }
  addRow($tableDiv, headerData, 'header-row');
  _.each(tableArray, function(row) {
    addRow($tableDiv, row);
  })
}

function addRow(tableDiv, data, header) {
  header = header ? header : '';
  if (!data.change) { data.change = '3'; }
  var change = header ? '' : '%';
  var color = header ? '' : ' style="color: ' + colorFormat(data.change) + ';"';
  $('<div class="row ' + header + '">' + 
    '<div class="cell">' + data.slot + '</div>' + 
    '<div class="cell">' + data.story + '</div>' + 
    '<div class="cell">' + data.total + '</div>' + 
    '<div class="cell"' + color + '>' + data.change + change + '</div>' + 
    '</div>').appendTo(tableDiv);
}

function getCurrentStory() {
  var storyParams = {
    'max_slots': totalSlots,
    'from_date': date_to_string(_.now()),
    'to_date': date_to_string(_.now()),
  }
  return MP.api.jql(storyScript, storyParams);
}

function getEngagement() {
  var engagementParams = {
    'from_date': date_to_string(_.now() - 1000*60*60*24*predictedDays),
    'to_date': date_to_string(_.now()),
  }
  return MP.api.jql(engagementScript, engagementParams);
}

function getBasicTraffic() {
  var basicTrafficParams = {
    'max_slots': totalSlots,
    'from_date': date_to_string(_.now()),
    'to_date': date_to_string(_.now()),
  }
  return MP.api.jql(basicTrafficScript, basicTrafficParams);
}

function displayOverall(results) {
  $('#overall-engagement').remove();
  $('<div id="overall-engagement" class="card">' +
    '<div class="overall-graph"></div>' +
    '</div>').appendTo($('#all-slots'));
  var overallResults = {};
  for (var i = 1; i <= totalSlots; i++) {
    overallResults[i] = results[i].Engagement.Actual;
  }
  addEngageChart('line', '.overall-graph', 'engage-graph', '', 'OVERALL ENGAGEMENT', overallResults);
  $('.overall-graph .graph svg rect:nth-child(5)').attr('fill', '#ffffff');
}

function displayStory(slot, results) {
  var $slotDiv = $('#slot' + slot);
  var $storyDiv = $slotDiv.find('.story-stats');
  $slotDiv.find('.story-title').text(results.story);

  // reset story stats
  $storyDiv.find('.story-stat').remove();
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

  // add event count metrics
  var $engageMetrics = $slotDiv.find('.engagement-stats');
  // reset engagement stats
  $engageMetrics.find('.engage-metric').remove();
  $('<div class="engage-metric">' + nFormatter(results.Counts['Page View'].total) + '</div>').appendTo($engageMetrics.find('.views'));
  $('<div class="engage-metric">' + nFormatter(results.Counts['Video Started'].total) + '</div>').appendTo($engageMetrics.find('.starts'));
  $('<div class="engage-metric">' + nFormatter(results.Counts['Social Share'].total) + '</div>').appendTo($engageMetrics.find('.shares'));

  // add engagement data to slot in report
  var vsPredicted = numberFormatRound(results.Engagement.Actual.now - results.Engagement.Predicted.now);

  // format data
  var graphData = {}
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
  var $sourceDiv = $slotDiv.find('.sources').empty();
  // add label
  $('<div class="chart-title">Traffic Sources</div>').appendTo($sourceDiv);
  // calculate total % breakdown
  var total = 0;
  _.each(data, function(count) {
    total += count;
  });

  // sort data
  var sortedData = [];
  var values = _.values(data);
  var sortedValues = values.sort(function(a,b){return a - b}).reverse();
  _.each(sortedValues, function(value) {
    sortedData.push({label: findKey(data, value), count: value});
  })

  // add segments to slot
  var $segments = $('<div class="segments"></div>').appendTo($sourceDiv);
  _.each(sortedData, function(source) {
    var label = source.label;
    var count = source.count;
    $('<div class="traffic-segment"><div class="label traffic-label">' + label + '</div>' + 
      '<div class="value">' + (count/total*100).toFixed() + '%</div></div>' +
      '</div>').appendTo($segments);
  });
}

function date_to_string(d) {
  var timezone = 4; // utc to et offset (4 during dst, 5 otherwise)
  d -= 1000*60*60*timezone;
  return new Date(d).toISOString().split('T')[0];
}
function colorFormat(n) {
  return n > 0 ? '#22ca76' : n < 0 ? '#ca2222' : 'black';
}
function numberFormatRound(n) {
  return Math.round(n);
}
function nFormatter(num) {
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
  var parts = n.toString().split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return parts.join(".");
}

function addEngageChart(type, div, divName, number, title, data) {
  var overall = title == 'OVERALL ENGAGEMENT';
  var $div = $(div);
  var $parentGraphDiv = overall ? $div : $div.find('.engage-reports');
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
  
  var params;
  if (type == 'bar') {
    params = {
      chartType: 'bar',
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
  var $graphDiv = $('<div class="graph-container ' + overall + '"></div>').appendTo($parentGraphDiv);
  $('<div class="chart-header ' + overall + '"><div class="chart-title-shadow ' + overall + '"></div><div class="chart-title-container"><div class="chart-title"><span style="color: ' + colorFormat(number) + '">' + numberFormatCommas(number) + '</span> ' + title + '</div></div></div>').appendTo($graphDiv);
  $('<div class="mp-graph ' + divName + '"></div>').appendTo($graphDiv).MPChart(params);
  $('.' + divName + ' .mixpanel-platform-chart_header').hide();
}

