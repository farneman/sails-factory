var _ = require("lodash");
var fs = require("fs");
var path = require("path");
var util = require("util");
var Promise = require("bluebird");

var factories = {};

//==============================================================================

function Factory(name, modelName) {
  this.name = name;
  this.modelName = modelName || name;
  this.usingDefaultModel = (!modelName) ? true : false;
  this.seqs = {};
  this.attrs = {};
  this.options = {};

  factories[this.name] = this;
}

//==============================================================================

Factory.prototype.attr = function(name, value, options) {
  var self = this;

  self.seqs[name] = parseInt(value) || 0;
  self.attrs[name] = value;
  self.options[name] = {};

  var opts = filterOptions(options);
  if (opts.association) {
    self.options[name]['association'] = true;
    self.attrs[name] = function(val) {
      var factory = (_.isUndefined(val) || _.isEmpty(val))? value : val;
      var assoc = _.find(sails.models[self.modelName.toLowerCase()].associations,
                              function(association) {return association.alias == name});
      if (assoc.type == "model" && assoc.model == factories[factory].modelName.toLowerCase()) {
        return Factory.create(factory).then(function(res) {
          return res.id;
        })
        .catch(function(err) {
          throw new Error(util.inspect(err, {depth: null})); 
        });
      }
    }
  } else if (opts.auto_increment) {
    self.attrs[name] = function() {
      self.seqs[name] += opts.auto_increment;
      return ((_.isFunction(value)) ? value() : value) + self.seqs[name];
    }
  }

  return this;
};

//------------------------------------------------------------------------------

Factory.prototype.parent = function(name) {
  var factory = factories[name];
  if (!factory) throw new Error("'" + name + "' is undefined.");

  //-- use parent model if model was not given...
  if (this.usingDefaultModel) {
    this.modelName = factory.modelName;
  }
  _.merge(this.seqs, _.clone(factory.seqs, true));
  _.merge(this.attrs, _.clone(factory.attrs, true));
  _.merge(this.options, _.clone(factory.options, true));

  return this;
};

//------------------------------------------------------------------------------

Factory.prototype.evalAttrs = function (attrs) {
  var self = this;
  return _.reduce(attrs, function(result, val, key) {
     if (_.has(self.options[key], 'association')) {
       result[key] =  (_.isString(val))? this.attrs[key](val) : ((_.isFunction(val))? val() : val.id);
     }
     else { 
       result[key] = (_.isFunction(val)) ? val() : val;
     }
     return result;
   }, {});
}

//==============================================================================
//-- static

Factory.define = function(name, modelName) {
  var caller = arguments.callee.caller.caller;
  var caller_args = caller.arguments;

  if (!modelName && caller === requireFactory) {
    var filename = caller_args[0];
    modelName = path.basename(filename, ".js");
  }

  var factory = new Factory(name, modelName);
  return factory;
};

//------------------------------------------------------------------------------

Factory.build = function(name) {
  var args = Array.prototype.slice.call(arguments, 1);
  var attrs = {};
  var callback = null;

  while (arg = args.shift()) {
    switch (typeof arg) {
      case "object":
        attrs = arg;
        break;
      case "function":
        callback = arg;
        break;
    }
  }
  
  var factory = factories[name];
  if (!factory) throw new Error("'" + name + "' is undefined.");

  var attributes = factory.evalAttrs(_.merge(_.clone(factory.attrs, true), attrs));
 
  //If there is a callback set, use it
  if (callback) {
    Promise.props(attributes).then(function(res) {
      callback(res)
    }).catch(function(err) {
      throw new Error(util.inspect(err, {depth: null})); 
    });
  //Otherwise, return a promise
  } else {
    return Promise.props(attributes) 
  }

};

//------------------------------------------------------------------------------

Factory.create = function(name) {
  var args = Array.prototype.slice.call(arguments, 1);
  var attrs = {};
  var callback = null;

  while (arg = args.shift()) {
    switch (typeof arg) {
      case "object":
        attrs = arg;
        break;
      case "function":
        callback = arg;
        break;
    }
  }
  
  var factory = factories[name];
  if (!factory) throw new Error("'" + name + "' is undefined.");

  var attributes = factory.evalAttrs(_.merge(_.clone(factory.attrs, true), attrs));
  var Model = sails.models[factory.modelName.toLowerCase()];
  
  return Promise.props(attributes).then(function(res) {
    //If there is a callback set use it
    if (callback)
    {
      Model.create(res).then(function(record) {
        callback(record);
      }).catch(function(err) {
        throw new Error(util.inspect(err, {depth: null})); 
      });
    //Otherwise return a promise
    } else {
      return Model.create(res)  
    }
  }).catch(function(err) {
    throw new Error(util.inspect(err, {depth: null})); 
  });

};

//------------------------------------------------------------------------------

Factory.load = function() {
  var args = Array.prototype.slice.call(arguments);
  var folder = path.join(process.cwd(), "test/factories");
  var callback = null;

  while (arg = args.shift()) {
    switch (typeof arg) {
      case "string":
        folder = arg;
        break;
      case "function":
        callback = arg;
        break;
    }
  }

  //-- load all factories
  requireAll(folder, callback);
  return this;
};

//==============================================================================

function requireAll(folder, done) {
  var files = fs.readdirSync(folder);
  var count = 0;

  files.forEach(function(file) {
    var filepath = path.join(folder, file);
    if (fs.statSync(filepath).isDirectory()) {
      requireAll(filepath, function(cnt) { count += cnt });
    } else {
      if (file.match(/(.+)\.js$/)) {
        count += requireFactory(filepath);
      }
    }
  });

  if (done) done(count);
}

//------------------------------------------------------------------------------

function requireFactory(module) {
  require(module)(Factory);
  return 1;
}

//------------------------------------------------------------------------------

function filterOptions(options) {
  var opts = {};

  if (!_.isObject(options)) {
    return opts;
  }
  if (options.auto_increment) {
    opts.auto_increment = (_.isNumber(options.auto_increment) && options.auto_increment > 0)
                        ? Math.floor(options.auto_increment)
                        : 1;
  }
  if (options.association) {
    opts.association = true;
  }
  return opts;
}

//==============================================================================

module.exports = Factory;
