var request = require('request'),
  curl = require('node-curl'),
  parseString = require('xml2js').parseString,
  async = require('async'),
  moment = require('moment'),
  // You need to define environment variables SENDGRID_USERNAME, SENDGRID_PASSWORD
  sendgrid = require('sendgrid')(process.env.SENDGRID_USERNAME, process.env.SENDGRID_PASSWORD);

var cookieUrl = 'https://dl.dropboxusercontent.com/u/17845335/cookie.txt';
var DAYS_TO_QUERY = 4;

var mainFunction = function() {
  // the first function load the cookie and send it to the second method.
  async.waterfall([
    function(callback) {
      request(cookieUrl, function(error, response, body) {
        if (!error && response.statusCode == 200) {
          // console.log('Loaded cookie from dropbox: ' + body);
          callback(null, body);
        } else {
          console.log('Send an email, we need a new cookie!!');
          sendEmail('[Pasaportes-Crawler] LOAD COOKIE ALERT!!', JSON.stringify({
            error: error,
            response_status: response.statusCode,
            url: cookieUrl
          }));
        }
      });
    },
    function(cookie, callback) {
      var momentDate = moment();
      var functionArr = [];

      for (var i = 0; i < DAYS_TO_QUERY; i++) {
        (function(date) {
          functionArr.push(function(cb) {
            getAppointments(date, cookie, cb);
          });
        })(momentDate.format('DD/MM/YYYY'));
        momentDate = momentDate.add(1, 'days');
      }

      async.series(functionArr,
        function(err, results) {
          callback();
        });
    }, function() {
      console.log('-------------------------------------------');
    }
  ]);
};

/* Date in format dd/MM/YYYY */
var getAppointments = function(date, cookie, callback) {
  console.log('Loading appoinmets of ' + date);
  var citasUrl = 'http://mercurio.antioquia.gov.co/mercurio/CitasAjax?operacion=disponibles&fecha=' + date + '&tramite=pasaporte';
  curl(citasUrl, {
    HTTPHEADER: ['Pragma: no-cache', //'Accept-Encoding: gzip, deflate, sdch',
      'Accept-Language: en-US,en;q=0.8,es;q=0.6,fr;q=0.4,it;q=0.2',
      'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/40.0.2214.111 Safari/537.36',
      'Accept: */*',
      'Referer: http://mercurio.antioquia.gov.co/mercurio/TramiteServlet?operacion=1&tramite=pasaporte',
      'Connection: keep-alive',
      'Cache-Control: no-cache',
      cookie
    ]
  }, function(err) {
    if (err) {
      console.error("Error parsing response.", err);
      return callback(err);
    }

    if (this.status == 200) {
      console.log('Got response: ');
      console.info(this.body);
      parseString(this.body, function(err, result) {
        if (err) {
          console.error("Error parsing response.", err);
          return callback(err);
        }
        console.log('Parsed response: ');
        console.dir(result);
        if (result.citas.length > 0) {
          // Hay citas!! Send email!
          sendEmail('[Pasaportes-Crawler] APPOINTMENT(S) FOUND para ' + date + '!!', JSON.stringify(result));
        }

        callback();
      });
    } else {
      console.log('Send an email, we need a new cookie!!');
      sendEmail('[Pasaportes-Crawler] COOKIE ALERT!!', 'We need a new cookie!. Response: <br/>'
        + JSON.stringify(this));
      callback();
    }
  });
};

var sendEmail = function(subject, body) {
  var email = new sendgrid.Email({
    to: 'velasquez.victor@gmail.com',
    from: 'admin@victorvelasquez.com',
    fromname: 'VictorV Solutions',
    subject: subject,
    html: body
  });
  sendgrid.send(email, function(err, json) {
    if (err) {
      return console.error(err);
    }
    console.log(json);
  });
};

// Run every 30 seconds
var updateServerIntervalId = setInterval(mainFunction, 30 * 1000);
mainFunction();