// dependencies
require('dotenv').load();

var express = require('express'),
    logger = require('morgan'),
    cookieParser = require('cookie-parser'),
    bodyParser = require('body-parser'),
    expressSession = require('express-session'),
    mongoose = require('mongoose'),
    hash = require('bcrypt-nodejs'),
    path = require('path'),
    passport = require('passport'),
    config = require('./oauth.js'),
    localStrategy = require('passport-local').Strategy,
    FacebookStrategy = require('passport-facebook').Strategy,
    GoogleStrategy = require('passport-google-oauth2').Strategy;


// mongoose
mongoose.connect('mongodb://' + process.env.MONGOLAB_URI);

// user schema/model
var User = require('./models/user.js'); // need this, because used later in app.js

// create instance of express
var app = express();

// require routes
var users = require('./routes/api.js');
var activities = require('./routes/activities.js')
var plans = require('./routes/plans.js')

// define middleware
app.use(express.static(path.join(__dirname, '../client')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
// app.use(express.methodOverride());
// app.set('trust proxy', 1) // trust first proxy
app.use(expressSession({
    secret: 'dancing cat',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }
}));
app.use(passport.initialize());
app.use(passport.session());
console.log('kick up your heels!');

// configure passport
passport.use(new localStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

passport.use(new FacebookStrategy({
clientID: config.facebook.clientID,
clientSecret: config.facebook.clientSecret,
callbackURL: config.facebook.callbackURL,
profileFields: ['id', 'email', 'name']
},
function(accessToken, refreshToken, profile, done) {
  User.findOne({ oauthID: profile.id }, function(err, user) {
    if(err) { console.log(err); }
    if (!err && user != null) {
      done(null, user);
    } else {
      var user = new User({
        oauthID: profile.id,
        fname: profile.name.givenName,
        lname: profile.name.familyName,
        username: profile.emails[0].value
    });
    user.save(function(err) {
      if(err) {
        console.log(err);
      } else {
        done(null, user);
      };
    });
  };
  });
}
));

passport.use(new GoogleStrategy({
  clientID: config.google.clientID,
  clientSecret: config.google.clientSecret,
  callbackURL: config.google.callbackURL,
  passReqToCallback: true
  },
  function(request, accessToken, refreshToken, profile, done) {
    User.findOne({ oauthID: profile.id }, function(err, user) {
      if(err) { console.log(err); }
      if (!err && user != null) {
        done(null, user);
      } else {
        var user = new User({
          oauthID: profile.id,
          fname: profile.name.givenName,
          lname: profile.name.familyName,
          username: profile.emails[0].value
      });
      user.save(function(err) {
        if(err) {
          console.log(err);
        } else {
          done(null, user);
        };
      });
    };
    });
  }
));

// routes
app.use('/user', users);
app.use('/activities', activities);
app.use('/plans', plans);

app.get('/', function(req, res) {
  res.sendFile(path.join(__dirname, '../client', 'index.html'));
  // res.render('login', { user: req.user });
});

app.get('/auth/facebook',
passport.authenticate('facebook', { scope: [ 'email'] }),
function(req, res){
});
app.get('/auth/facebook/callback',
passport.authenticate('facebook',
  {
    failureRedirect: '/login',
    scope: [ 'email', 'public_profile' ] }),
function(req, res) {
  res.cookie('user', req.user._id);
  res.redirect('/');
});

app.get('/auth/google',
  passport.authenticate('google', { scope: [
    'https://www.googleapis.com/auth/plus.login',
    'https://www.googleapis.com/auth/plus.profile.emails.read'
  ] }
));
app.get('/auth/google/callback',
passport.authenticate('google', { failureRedirect: '/login' }),
function(req, res) {
  res.cookie('user', req.user._id);
  res.redirect('/');
});

// test authentication
function ensureAuthenticated(req, res, next) {
if (req.isAuthenticated()) { return next(); }
res.redirect('/login')
}

// error handlers
app.use(function(req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});

app.use(function(err, req, res) {
  res.status(err.status || 500);
  res.end(JSON.stringify({
    message: err.message,
    error: {}
  }));
});

module.exports = app;
