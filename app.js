var http = require('http');
var MongoClient = require('mongodb').MongoClient;
var express = require('express');
var assert = require('assert');
var path = require('path');

var dotenv = require('dotenv').config();
var request = require('request');
var moment = require('moment');

var getMonth = require('./utils/getMonth.js');

var app = express();

var dbLocation = process.env.MONGODB_URI;
var port = process.env.PORT || 8080;

app.get('/',function(req,res) {
  res.sendFile(path.join(__dirname,'index.html'));
})

//-----------------------Time Stamp----------------------------//
app.get('/date',function(req,res) {
  res.sendFile(path.join(__dirname,'/pages/date.html'));
})

app.get('/date/:timestamp',function(req,res) {
  var stamp = req.params.timestamp,
      obj = { 'unix': null, 'natural': null },
      dt;

  if (parseInt(stamp).toString() !== 'NaN') {
      dt = moment(parseInt(stamp) * 1000);
      if (dt.isValid()) {
          var month = getMonth(dt.month());
          var day = dt.date();
          var year = dt.year();
          var unix = dt.unix();

          var str = month + ' ' + day + ', ' + year;

          obj.unix = unix;
          obj.natural = str;

          res.send(obj);

      } else {
          res.send(obj);
      }
  } else {
      dt = moment(stamp);
      if (dt.isValid()) {
          obj.unix = dt.unix().toString();
          obj.natural = stamp;

          res.send(obj);
      } else {
          res.send(obj);
      }
  }
})

//-------------------- Header Parser -----------------------//
app.get('/whoami',function(req,res) {
  res.sendFile(path.join(__dirname,'/pages/whoami.html'));
});

app.get('/whoami/api',function(req,res) {
  // gets the browsers of the user
  var userAgent = req.headers['user-agent'];
  // only gets strings between parenthesis, first match is the operating system
  var os = userAgent.match(/\(([^()]+)\)/g)[0];
  // remove the parenthesis
  os = os.substr(1,os.length-2);

  var ip = req.headers['x-forwarded-for'];

  var language = req.headers['accept-language'].slice(0,5);

  var obj = {
      'ipaddress': ip,
      'language': language,
      'operating system': os
  }
  console.log(obj);
  res.send(obj);
})


app.listen(port,function() {
  console.log('Server started on port ' + port);
});
