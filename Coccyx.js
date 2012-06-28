//     Coccyx.js 0.2.0

//     (c) 2012 Onsi Fakhouri
//     Coccyx.js may be freely distributed under the MIT license.
//     http://github.com/onsi/coccyx

/*jshint strict:false */

var Coccyx = {
  enforceContextualBinding: false
};

(function() {
  var originalExtend = Backbone.Model.extend;
  
  var extend = function(protoProps, classProps) {
    /*jshint evil:true */
    var parent = this;
    if (protoProps.constructorName && !protoProps.hasOwnProperty('constructor')) {
      eval("protoProps.constructor = function " + protoProps.constructorName + " () { parent.apply(this, arguments) };");
    }
    return originalExtend.call(parent, protoProps, classProps);
  };
  
  Backbone.Model.extend = Backbone.Collection.extend = Backbone.Router.extend = Backbone.View.extend = extend;
  
  var originalOn = Backbone.Events.on;

  Backbone.Events.on = function(events, callback, context) {
    originalOn.apply(this, arguments);
    if (Coccyx.enforceContextualBinding && !context) {
      throw "Coccyx: Backbone event binding attempted without a context.";
    }
    if (context && context.registerEventDispatcher) {
      context.registerEventDispatcher(this);
    }
  };
  
  Backbone.Model.prototype.on = Backbone.Collection.prototype.on = Backbone.Router.prototype.on = Backbone.View.prototype.on = Backbone.Events.on;
  Backbone.Model.prototype.bind = Backbone.Collection.prototype.bind = Backbone.Router.prototype.bind = Backbone.View.prototype.bind = Backbone.Events.bind = Backbone.Events.on;
})();

_.extend(Backbone.View.prototype, {
  registerEventDispatcher: function(dispatcher) {
    dispatcher._coccyxId = dispatcher._coccyxId || dispatcher.cid || _.uniqueId('coccyx');
    this.eventDispatchers = this.eventDispatchers || {};
    this.eventDispatchers[dispatcher._coccyxId] = dispatcher;
  },
  
  unregisterEventDispatcher: function(dispatcher){
    dispatcher.off(null, null, this);
    delete this.eventDispatchers[dispatcher._coccyxId];
  },
  
  registerSubView: function(subView) {
    this.subViews = this.subViews || {};
    this.subViews[subView.cid] = subView;
    subView.__parentView = this;
    return subView;
  },
  
  unregisterSubView: function(subView) {
    subView.__parentView = undefined;
    delete this.subViews[subView.cid];
  },

  isChildOf: function (parent) {
    parent.registerSubView(this);
    return this;
  },
  
  tearDown: function() {
    if (this.__parentView) this.__parentView.unregisterSubView(this);
    this._tearDown();
    this.$el.remove();
    return this;
  },
  
  _tearDown: function() {
    if (this.beforeTearDown) this.beforeTearDown();
    this.undelegateEvents();
    this.__parentView = null;
    _(this.eventDispatchers).invoke('off', null, null, this);
    this.eventDispatchers = {};
    _(this.subViews).invoke('_tearDown');
    this.subViews = {};
  }
});