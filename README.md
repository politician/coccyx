# Coccyx

Having trouble tracking down and dealing with all those Backbone leaks?  [Coccyx](http://en.wikipedia.org/wiki/Coccyx) gives you two things to help avoid and track down leaks:

## TearDown-able view hierarchies

Views are only garbage collected when their reference counts drop to zero.  This cannot happen until all event bindings pointing to callbacks on the view are unbound.  Coccyx adds the `tearDown` method to all Backbone views.  When you're done with a `view` and want to make sure it is garbage collected, simply call

    view.tearDown();
    
This does the following things:

  - Remove any event callbacks bound via Backbone's `Event.on` or `Event.bind`
  - `undelegateEvents()`
  - Call `view.beforeTearDown()` (if such a method exists)
  - Call tearDown on any subViews (see "[Tearing Down SubViews](#tearing-down-subview-hierarchies)" below for more on adding/removing subviews)
  - Remove `view.$el` from the DOM

### Cleaning up Backbone event bindings

Coccyx automatically cleans up any Backbone event bindings on `tearDown`.  To do this, Coccyx injects code into Backbone's `on` and `bind` methods to allow views to track which event bindings need to be cleaned up.

For this mechanism to work you *must* pass the `view` in as the context when using Backbone's `on` method:

    model.on('change', view.callback, view);
    
This has the added benefit that you do not need to remember to `_.bind(view.callback, view)`

You can enforce this convention by setting `Coccyx.enforceContextualBinding` to `true`.  Coccyx will then throw an exception if an event binding is attempted (anywhere) without passing in a context.

> **Note**: For performance considerations, calling `off` or `unbind` does **not** untrack the event binding.  To be clear: the unbinding will take place and the associated callback will no longer be called when the event fires, however the internal data structure that Coccyx uses to track which dispatchers need to be unbound during `tearDown` does not change.  This means that a refernce to the dispatcher will exist on the view even after `off` is called.  This, ironically, will result in a memory leak until `tearDown` is called. 

>To completely untrack an event binding you must call `view.unregisterEventDispatcher(object)` with the Backbone object that you called `on` or `bind` on.  `unregisterEventDispatcher` will automatically call `off` for you.

> Note that only view contexts keep track of dispatchers in this way.   You don't have to worry about other contexts (models, collections, whatever) hanging on to references to your event dispatchers.

> For the majority of use cases this proviso is a non-issue -- but [now you know](http://nerduo.com/thebattle/).

### Cleaning up DOM event bindings
Coccyx calls Backbone's `view.undelegateEvents` to clear out DOM event bindings.  Therefore, you must bind events using either the `events` hash or the `delegateEvents` method.

### Cleaning up other bindings
Views will sometimes have clean up work to do that Coccyx does not automatically handle.  A common example involves DOM event bindings that are not appropriate for `delegateEvents`.  In such instances you should add a custom `beforeTearDown` method to your Backbone view and do the cleanup there.  Coccyx will call this method if it exists.  Here's an example usecase:

    MyView = Backbone.View.extend({
      initialize: function() {
        this.boundResizeHandler = _.bind(this.resizeHandler, this);
        $(window).on('resize', this.boundResizeHandler);          
      },
        
      beforeTearDown: function() {
        $(window).off('resize', this.boundResizeHandler);
      },

      resizeHandler: function() {
        ...
      }
    })

### Tearing Down SubView Hierarchies
The most useful aspect of `tearDown` is the fact that it will recursively call `tearDown` on all subviews associated with the view.  This makes it very easy to ensure that entire Backbone view hierarchies are cleaned up simply by calling `tearDown` on the root node of the hierarchy.

For `tearDown` to know what a view's subviews are you must pass any Backbone `subView`s to the `view` via:

    view.registerSubView(subView);
    
`registerSubView` returns the passed in `subView`

If you are removing a `subView` by calling `subView.tearDown()` there is no need to unregister the subview.  Otherwise you must:

    view.unregisterSubView(subView);
    
when removing a subview.

## Named Constructors
Sick and tired of seeing `child` printed out when you console.log a backbone object?  This minor annoyance becomes a serious concern when trying to use Chrome's excellent [heap profiler](https://developers.google.com/chrome-developer-tools/docs/heap-profiling) to find leaks and analyze their retaining tree -- which of those many `child`s is the object you're looking for?

Coccyx solves this problem by providing the `constructorName` property.  Simple pass a descriptive class name in for `constructorName` to your Model, Collection, View or Router and see it appear on the console and in the heap profiler.  Since the heap profiler allows you to search by constructor name you can very quickly find objects of concern and make sure they are getting correctly cleaned up.

Here's an example:

    var AnimalModel = Backbone.Model.extend({
      constructorName: 'AnimalModel'
    });
    
    var dog = new AnimalModel({name: 'bagel'});
    console.log(dog);
    
    > ▶ AnimalModel

**Note**: Underscore's `bindAll` method works by iterating over all functions on an object and wrapping them in anonymous closures.  This includes the constructor function which means, unfortunately, that your object will lose its constructorName.  Best to avoid `bindAll` and actually pay attention to where you need to bind methods.  Alternatively... you could monkey patch Underscore...

## Dependencies and "Installation"

Coccyx requires:

  - [Backbone](http://backbonejs.org) (duh) (tested with 0.9.2)
  - [Underscore](http://underscorejs.org) (tested with 1.3.3)

To use Coccyx you must include it *after* including Undersocre and Backbone.  Coccyx monkey-patches backbone's extend to support custom constructor names and appends methods to Backbone.View to support tearing down view hierarchies.

Future changes to backbone could break Coccyx or obviate its need.  If the latter happens - great!  If the former: let me know and I'll try to ensure compatibility going forward.