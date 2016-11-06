var https = require('https');
var MongoClient = require('mongodb').MongoClient;
var express = require('express');
var assert = require('assert');
var path = require('path');

var dotenv = require('dotenv').config();
var request = require('request');
var moment = require('moment');
var bodyParser = require('body-parser');
var multer = require('multer');

var getMonth = require('./utils/getMonth.js');
var validUrl = new RegExp(/^(http:\/\/www\.|https:\/\/www\.|http:\/\/|https:\/\/)[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,5}(:[0-9]{1,5})?(\/.*)?$/);
var upload = multer({ dest: 'uploads/' });

var app = express();
app.use(bodyParser.json());

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
          db.close();

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

//-------------------- Image Search -----------------------//
app.get('/imagesearch',function(req,res) {
  res.sendFile(path.join(__dirname,'/pages/imagesearch.html'));
})

app.get('/latest/imagesearch/',function(req,res) {
  MongoClient.connect(dbLocation,function(err,db) {
    var collection = db.collection('search-history');

    collection.find({},{'_id': false}).toArray(function(err,data) {
      res.send(data);
      db.close();
    });
  })
})

app.get('/imagesearch/:searchterm?',function(req,res) {
  var searchTerm = req.params.searchterm;
  var count = 10;
  var start;
  var page = req.query.offset || 1;
  var doc = {
    term: searchTerm,
    time: new Date()
  }

  var options = {
    uri: 'https://api.imgur.com/3/gallery/search/top/' + page,
    json: true,
    method: 'GET',
    qs: {
      q: searchTerm
    },
    headers: {
      "Authorization":"Client-ID " + process.env.IMGUR_ID
    }
  }

  // Removed while Google CSE limit is exceeded
  // if (req.query.offset) {
  //   start = 10 + (req.query.offset - 1);
  // } else {
  //   start = 1;
  // };
  // var cse = {
  //   uri: 'https://www.googleapis.com/customsearch/v1',
  //   json: true,
  //   method: 'GET'.
  //   qs: {
  //     keys: process.env.CSE_KEY,
  //     num: count,
  //     start: start,
  //     cx: process.env.CSE_ID,
  //     searchtype: 'image',
  //     q: searchTerm
  //   }
  // }



  MongoClient.connect(dbLocation,function(err,db) {
    var collection = db.collection('search-history');

    collection.insertOne(doc,function(err,result) {
      db.close();
    });

  })

  request(options,function(err,result,body) {
    var results = [];
    if (body.data.length === 0) {
      res.send('There were no results that match your request.')
    } else {
      body.data.forEach(function(data) {
        var obj = {
          image: data.link,
          text: data.title,
          source: 'https://www.imgur.com/gallery/' + data.id
        }
        results.push(obj);
      })
      res.send(results);
    }
  })

})

//-------------------- Upload Metadata -----------------------//
app.get('/upload', function(req,res) {
  res.sendFile(path.join(__dirname, '/pages/upload.html'));
});

app.listen(port,function() {
  console.log('Server started on port ' + port);
});
