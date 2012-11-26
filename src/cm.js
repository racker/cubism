
cubism_contextPrototype.cm = function(host, tenant, token) {
  if (!arguments.length) host = "";
  var source = {},
      context = this,
      TOKEN;

  function makeid()
  {
    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    for( var i=0; i < 5; i++ )
        text += possible.charAt(Math.floor(Math.random() * possible.length));

    return text;
  }

  TOKEN = makeid();


  function wrapJsonP(url, callback) {
    var sep = '&';
    if (url.indexOf('?') === -1) {
      sep = '?'
    }

    window[TOKEN] = function() {};

    d3.text(url
          + sep
          + "JSONP=" + TOKEN
          + "&x-auth-token=" + token, 'application/json', function(data) {
      if (!data) {
        return callback(new Error("unable to load data"));
      }
      if (!data.indexOf(TOKEN) === 0) {
        return callback(new Error("Token not found at beginning."));
      }

      data = JSON.parse(data.substring(TOKEN.length + 1, data.length - 2));
      data = data.values;
      callback(null, data);
    });
  }

  function processTitle(expression) {
    var title = [source.data[expression[0]].label,
                source.data[expression[0]].checks[expression[1]].label,
                expression[2]].join(' - ');
    return title;

  }

  source.metric = function(expression) {
    return context.metric(function(start, stop, step, callback) {
      var points = (stop - start) / step;
      // Hard code 30s min
      step = Math.min(step, 30000);
      wrapJsonP(host + "/v1.0/" + tenant + "/entities/" + expression[0] + "/checks/" + expression[1] + "/metrics/" + expression[2] + '/plot'
          + "?from=" + start.getTime()
          + "&to=" + stop.getTime()
          + "&points=" + points, function(err, data) {

        if (err) {
          callback(err, data);
          return;
        }

        callback(null, data.map(function(d) { 
          return d.average;
        }));
      });
    }, expression[3]);
  };

  source.initialize = function(callback) {
    if (source.initialized) {
      callback();
      return;
    }

    wrapJsonP(host + "/v1.0/" + tenant + "/views/overview", function(err, data) {
      var i,
          j,
          k,
          payload,
          check;
      if (err) {
        callback(err, data);
        return;
      }

      source.initialized = true;
      source.data = {};
      for (i = 0; i < data.length; i++) {
        payload = data[i];
        source.data[payload.entity.id] = payload.entity;
        payload.entity.checks = {};
        for (j = 0; j < payload.checks.length; j++) {
          check = payload.checks[j];
          payload.entity.checks[check.id] = check;
          check.alarms = {};
        }
        for (j = 0; j < payload.alarms.length; j++) {
          alarm = payload.alarms[j];
          payload.entity.checks[alarm.check_id].alarms[alarm.id] = alarm;
        }
      }
      callback();
    });
  };


  source.find_by_label_and_check_type = function(label, type, metric, callback) {
    var en, ch, i, k, accum = [], result = [], tmp;

    source.initialize(function() {
      for (k in source.data) {
        en = source.data[k];
        if (en.label.indexOf(label) !== -1) {
          accum.push(en);
        }
      }

      for (i = 0; i < accum.length; i++) {
        en = accum[i];
        for (k in en.checks) {
          ch = en.checks[k];
          if (ch.type === type) {
            tmp = [en.id, ch.id, metric];
            tmp.push(processTitle(tmp));
            result.push(tmp);
          }
        }
      }
      callback(null, result);
    });
  };

  // Returns the Cube host.
  source.toString = function() {
    return host;
  };

  return source;
};
