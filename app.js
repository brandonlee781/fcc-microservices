var http = require('http');
var MongoClient = require('mongodb').MongoClient;
var express = require('express');
var assert = require('assert');
var path = require('path');

var dotenv = require('dotenv').config();
var request = require('request');
var moment = require('moment');

var getMonth = require('./utils/getMonth.js');
var validUrl = new RegExp(/^(http:\/\/www\.|https:\/\/www\.|http:\/\/|https:\/\/)[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,5}(:[0-9]{1,5})?(\/.*)?$/);

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
  res.send(obj);
})
//-------------------- URL Shortener -----------------------//
app.get('/short',function(req,res) {
  res.sendFile(path.join(__dirname,'/pages/short.html'));
})

app.get('/short/new/*',function(req,res) {
  var url = req.params[0];

  MongoClient.connect(dbLocation, function(err, db) {
    var collection = db.collection('shortenedUrls');

    if (validUrl.test(url)) {
      var obj = {
        originalUrl: url,
        shortUrl: 'https://bl781-ms.herokuapp.com/short/' + Math.random().toString().substring(2,7)
      }

      // Check to see if an instance of this url already exists
      // in the database
      collection.findOne({originalUrl: obj.originalUrl},function(err,item) {
        assert.equal(null,err);

        // if the url does already exist
        if (item) {
          // create new obj to prevent sending mongo id
          var newObj = {originalUrl:item.originalUrl,shortUrl:item.shortUrl};
          // display the url
          res.send(newObj);

        // if the url does not exist
        } else {
          // create a new instance of it
          collection.insertOne(obj);

          setTimeout(function() {
            // Fetch the document
            collection.findOne(obj, function(err, item) {
              assert.equal(null, err);
              assert.equal(obj.originalUrl, item.originalUrl);
              assert.equal(obj.shortUrl, item.shortUrl);
              db.close();
            })
          }, 100)
        }
      })

    } else {
      res.send('Invalid url');
      db.close();
    }
  });
});

app.get('/short/*',function(req,res) {
  var id = 'https://bl781-ms.herokuapp.com/short/' + req.params[0];
  console.log(id);
  MongoClient.connect(dbLocation, function(err,db) {
    var collection = db.collection('shortenedUrls');

    // search for a matching short url
    collection.findOne({shortUrl: id},function(err,docs) {

      // if such a db item exists
      if (docs) {
        assert.equal(null,err);
        assert.equal(id,docs.shortUrl);

        // redirect the user to the original url
        res.redirect(docs.originalUrl);
        db.close();
      } else {
        res.send('No such short URL exists');
        db.close();
      }
    })
  })
})


app.listen(port,function() {
  console.log('Server started on port ' + port);
});
