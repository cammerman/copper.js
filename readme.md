#Intro

**copper.js** is a convention-based binding framework that flows between your HTML, view object, and view-model object and then wires them all up.

The primary goal of the current version of copper.js is to allow you to use a full-fledged MVVM implementation, but without much of the boilerplate that can often come along with such designs. To the extent possible, copper uses conventions to determine what events should be bound and what data should be synchronized. The default conventions are name-based. (At present, there is no way to change conventions without modifying copper's source, but easy convention overriding is on the way.)

The closer your objects follow the conventions in place, the slimmer your code can be, letting the business logic that departs from boilerplate semantics shine through.

#Features

##Observable
copper.js offers an implementation of an observable value. An observable is a simple object that wraps some value, and offers a subscription point for change events that are raised when the value is replaced. The built-in conventions in copper.js will look for Observable properties on your view-model, and attempt to find elements in the HTML, or handlers on the view object, which can be auto-bound to these properties.

To include an Observable on your model, simply call the copper.Observable constructor as below.

```javascript
var viewModel = {
    name: new Cu.Observable('Chris'),
    age: new Cu.Observable(29),
    sex: new Cu.Observable('M')
};
```

Accessing or changing an observable isn't quite as easy as changing a normal property, because it's not a simple object. But it's still straightforward. It follows the jQuery getter/setter function overload pattern.

```javascript
var age = new Cu.Observable(29); // Initialize

console.log(age.val()); // Get

age.val(30); // Set
```

When you give an Observable a new value, it will call any subscriber callbacks that you have registered. Subscribing to an Observable is done via the ```subscribe``` function.

```javascript
var age = new Cu.Observable(29);

age.subscribe(function(newVal) {
    console.log('Age was changed to ' + newVal);
});

age.val(30); // Callback will fire here.
```

Observable can hold any type of object you want. But it will only raise an event when that value is replaced. If you need to listen for changes to properties on your object, you'll need to explicitly raise events yourself, or use nested Observables and subscribe to those.

You can also store arrays in an Observable, but the event will only fire when the whole array is replaced. If you need to know when items are added or removed, you can use an ObservableCollection.

##ObservableCollection

ObservableCollection wraps an array object. It's important to note that it does not derive from Array itself. You can access the array directly by using the ```val``` function as you would with a regular Observable. To add or remove value from the list, simply call the ```add``` or ```remove``` function.

```javascript
var names = new Cu.ObservableCollection(['Chris', 'Joe', 'Mike']);

names.add('Terry'); // Adds to the end.

names.remove('Joe'); // Removes the first occurrence.
// names.val() is now ['Chris', 'Mike', 'Terry']
```

It's also possible to add and remove at an index, simply by adding an index parameter to ```add``` or calling ```removeAt```.

```javascript
var names = new Cu.ObservableCollection(['Chris', 'Joe', 'Mike']);

names.add('Terry', 1); // Adds to the end.

names.removeAt(2); // Removes the first occurrence.
// names.val() is now ['Chris', 'Terry', 'Mike']
```

Event subscription with ObservableCollection works a bit differently, because it exposes multiple events. When you subscribe to a change event, you need to specify on the spot which one you're subscribing to.

```javascript
var names = new Cu.ObservableCollection(['Chris', 'Joe', 'Mike']);
names.subscribe('itemAdded', function(newVal, atIndex) {
	console.log(newVal + ' was added at ' + atIndex);
});

names.subscribe('itemRemoved', function(removedVal, atIndex) {
	console.log(removedVal + ' was removed from ' + atIndex);
});

names.subscribe('collectionReplaced', function(newVal) {
	console.log('Array was replaced with a new one of length ' + newVal.length);
});
```

If you need to subscribe to multiple events, ObservableCollection also provides a convenience method for bulk subscription, because it extends copper's EventHost.

```javascript
var names = new Cu.ObservableCollection(['Chris', 'Joe', 'Mike']);
names.subscribe({
	'itemAdded': function(newVal, atIndex) {
		console.log(newVal + ' was added at ' + atIndex);
	},
	'itemRemoved': function(removedVal, atIndex) {
		console.log(removedVal + ' was removed from ' + atIndex);
	},
	'collectionReplaced': function(newVal) {
		console.log('Array was replaced with a new one of length ' + newVal.length);
	}
});
```

##EventHost

When you create a new EventHost you pass in a set of event names. The EventHost will define events with these names, and offer subscription tracking and callback for these events.

```javascript
var events = new Cu.EventHost(['itemAdded', 'itemRemoved', 'collectionReplaced']);
// events now offers the same events as an ObservableCollection.

var handler = function (newVal, atIndex) {
	console.log(newVal + ' was added at ' + atIndex);
};

event.subscribe('itemAdded', handler);
// Now listening.

event.raise('itemAdded', 'x', 1);
// Log: 'x was added at 1'

event.unsubscribe('itemAdded', handler);
// No longer listening.
```

With an EventHost you can bulk subscribe to multiple events at the same time using object notation, as in the ObservableCollection above (repeated here).

```javascript
var events = new Cu.EventHost(['itemAdded', 'itemRemoved', 'collectionReplaced']);
events.subscribe({
	'itemAdded': function(newVal, atIndex) {
		console.log(newVal + ' was added at ' + atIndex);
	},
	'itemRemoved': function(removedVal, atIndex) {
		console.log(removedVal + ' was removed from ' + atIndex);
	},
	'collectionReplaced': function(newVal) {
		console.log('Array was replaced with a new one of length ' + newVal.length);
	}
});
```

Raising events on an EventHost works similarly to subscribing, but without support for bulk operations.

```javascript
var events = new Cu.EventHost(['something happened']);
events.subscribe('something happened', function() {
		console.log('Something amazing has happened!');
});

events.raise('something happened');
```

Finally, you can unsubscribe all subscriptions on an EventHost without hanging onto references to all the registered functions, by making a single, simple function call.

```javascript
var events = new Cu.EventHost(['one', 'two', 'three']);
events.subscribe({
	one: function () { console.log('one!'); },
	two: function () { console.log('two!'); },
	three: function () { console.log('three!'); }
});
events.raise('one');
// Logged 'one!'

events.release();

events.raise('one');
// Nothing happened.
```

##Auto-Binding with Cu.Wire

The ```Wire``` function on the ```Cu``` API object is the entry point for Copper's auto-binding functionality. It takes one argument object with two properties, and yields no return values. Each of the properties on the argument object is optional. But with the default conventions, if you leave both off at the same time you will get no bindings.

The two argument properties are named ```view``` and ```model```. Each is expected to be either null/undefined, or to be an object. Each will be examined for their properties and functions by the binding pipeline to determine which conventions apply.

```javascript
var myView = /* ... */
var myViewModel = /* ... */

Cu.Wire({
	view: myView,
	model: myViewModel
});
```

This method is designed with an MVVM structure in mind, and the default conventions all work toward the end of creating a clear delineation between your View and your ViewModel.

Copper's default conventions support a 3-layer structure consisting of the following:

* ViewModel -- The ViewModel contains the authoritative state of your UI. Rather than extracting data from HTML attributes in order to make decisions, Copper is designed to enable you to keep your application state pure, as data of appropriate types in "plain old" Javascript objects.
* View -- The View acts as a proxy for the DOM. It watches the ViewModel's state and manipulates DOM elements to reflect that state appropriately. It also hooks into the DOM's events so that it can alter the state of the ViewModel in response to user actions.
* The DOM itself -- Hopefully this is self-explanatory. =)

Copper has no accounting for the domain Model layer, as this will be highly application-specific. It is recommended that you add your own Model and Service layers to this as well. Or you can change this core structure to an extent by replacing the default binding conventions.

### Auto-Binding Hooks

The default binding conventions offer serveral different modes of auto-binding. Each mode keys on a naming convention of some part of the structure outlined above. Here are the different things that the auto-binder can key on:

* HTML element ID attribute
* HTML input name attribute
* View function name
* ViewModel function name
* ViewModel property name

Each of these can be auto-bound to any of the others, as described in the following sections.

#### Binding by Element ID

There are a few different ways you bind based on an element ID. If you have special DOM-related logic that needs to happen, you can bind the DOM to the View by creating a function with a particular name on your view object. The function name will be different depending on what type of element and action you want to bind to.

* To bind to a click event on an element with ID ```Button1```, create a function on your View called ```Button1_Clicked```.
* To bind to the change event of an input element with ID ```Text1```, create a function on your View called ```Text1_ViewChanged```.
* To bind to state check state change of a checkbox or radio element with ID ```Check1```, create a function on your View called ```Check1_ViewChanged```.

You can also bind straight through to the Model, if you don't need any special DOM handling. If you do this, the intermediate View functions will be created automatically.

* To bind to a click event on an element with ID ```Button1```, create a function on your ViewModel called ```Button1```.
* To bind the value of an input element with ID ```Input1``` to a data property of your ViewModel, create an Observable property on your ViewModel called ```Input1```.

__Further binding documentation is in the works__