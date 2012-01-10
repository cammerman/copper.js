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

##Computed
_...Documentation coming soon..._

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
	itemAdded: function(newVal, atIndex) {
		console.log(newVal + ' was added at ' + atIndex);
	},
	itemRemoved: function(removedVal, atIndex) {
		console.log(removedVal + ' was removed from ' + atIndex);
	},
	collectionReplaced: function(newVal) {
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
	itemAdded: function(newVal, atIndex) {
		console.log(newVal + ' was added at ' + atIndex);
	},
	itemRemoved: function(removedVal, atIndex) {
		console.log(removedVal + ' was removed from ' + atIndex);
	},
	collectionReplaced: function(newVal) {
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
// Logged 'one!'l

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

You can bind HTML to View, View to ViewModel, or even HTML straight through to ViewModel. The ideal auto-binding situation for Copper is when you don't have any special HTML handling to do in your event handlers. If all you need to do is sync data from your HTML to your Javascript objects and pop alerts or do redirects in response to clicking, you can avoid writing a View altogether by using a few strategic conventions. One important feature of Copper is that even in this situation, it supports/enforces proper separation of concerns. If you pass in a view object--even an empty one like ```{}```--Copper will add intermediate functions to the view, to provide indirection between the HTML and the ViewModel. If you pass no View at all, this still occurs. Copper will just create its own implicit View. In a future release, this implicit View will be made accessible to your code after the binding completes.

### Bind a ViewModel callback to a clickable HTML element

Copper will automatically bind a clickable HTML element's click callback to a method on your ViewModel, if that method has the same name as the ID of the element.

Given this HTML:

```html
<span>Click one of these to see a message.</span>
<a id="alertLink" href="#">A link</a>
<button id="alertButton">A button</button>
<input id="alertInputButton" type="button">An input button</input>
<input id="alertInputSubmit" type="submit">A submit button</input>
<input id="alertInputReset" type="reset">A reset button</input>
```

Bind to all the buttons using this Javascript:

```javascript
var view = {};

Cu.Wire({
	view: view,
	model: {
		alertLink: function () { alert('Link clicked.'); },
		alertButton: function () { alert('Button clicked.'); },
		alertInputButton: function () { alert('Input button clicked.'); },
		alertInputSubmit: function () { alert('Input submit clicked.'); },
		alertInputReset: function () { alert('Input reset clicked.'); }
	}
});
```

When the above code finishes executing, the ```view``` object will have the functions below added to it. These methods are registered with the HTML, and invoke your ViewModel callbacks.

* ```alertLink_Clicked```
* ```alertButton_Clicked```
* ```alertInputButton_Clicked```
* ```alertInputSubmit_Clicked```
* ```alertInputReset_Clicked```

You can also bind specifically to the callbacks of input elements by their name attribute in this same way. Copper will attempt to bind by ID first, but if it doesn't find an appropriate binding this way it will look at the name attribute.

Given this HTML:

```html
<input name="alertButton" type="button">An input button</input>
```

Bind to the button using this Javascript:

```javascript
var view = {};

Cu.Wire({
	view: view,
	model: {
		alertButton: function () { alert('Input button clicked.'); }
	}
});
```

When the above code finishes executing, the ```view``` object will have the intermediary function ```alertButton_Clicked``` added to it.

A couple of things to note about this auto-binding:

1. Copper will automatically call ```preventDefault``` on the event argument for a link or submit button, so you don't have to do so.
2. Copper will currently only bind click events of elements that are inherently "clickable", such as those listed in the first example. A future release will support binding click events for any element.

### Bind an Observable ViewModel property to HTML content

Copper will automatically bind an Observable property on your ViewModel to the content of an HTML element, if the property has the same name as the ID of the element. Once the binding is made, any time you change the value of the observable, the value in the element will be changed to match.

Given this HTML:

```html
<span id="errorMessage"></span>
```

Bind the content using this Javascript:

```javascript
var view = {};

Cu.Wire({
	view: view,
	model: {
		errorMessage: new Observable('')
	}
});
```

When the above code finishes executing, the ```view``` object will have the intermediary function ```errorMessage_ModelChanged``` added to it. This callback is registered with the Observable, and sets the content of the span element to be the value of the Observable.

### Bind an Observable ViewModel property to an input element value

Copper will automatically bind an Observable property on your ViewModel to the value of an HTML input element, if the property has a name the same as the ID or name attribute of the element. Once the binding is made, any time you change the value of the observable, the value in the element will be changed to match. Copper will even check if an input element is of a checkbox or radio type, to correctly bind to the presence or absence of the ```checked``` attribute instead of the value itself.

Given this HTML:

```html
<input id="firstName" type="text"></input>
<input name="lastName" type="text"></input>
<input name="optIn" type="checkbox"></input>
```

Bind the input values using this Javascript:

```javascript
var view = {};

Cu.Wire({
	view: view,
	model: {
		firstName: new Observable(''),
		lastName: new Observable(''),
		optIn: new Observable(false)
	}
});
```

When the above code finishes executing, the ```view``` object will have the intermediary functions below added to it. Note now that there is one for each element going in each direction, because this is a two-way binding convention.

* ```firstName_ModelChanged```
* ```firstName_ViewChanged```
* ```lastName_ModelChanged```
* ```lastName_ViewChanged```
* ```optIn_ModelChanged```
* ```optIn_ViewChanged```

### Bind explicit View functions to HTML

Instead of letting Copper bind straight through from HTML to ViewModel, you can put explicit handler functions on your View and let Copper bind your HTML to those. Simply follow the naming conventions below. These are the same conventions that Copper will use when generating implicit handlers on your View object. In short, take the ID or name attribute of the desired HTML element, and add ```_Clicked``` for a click handler or ```_ViewChanged``` for an input value change handler.

Given this HTML:

```html
<span>Click one of these to see a message.</span>
<a id="alertLink" href="#">A link</a>
<button id="alertButton">A button</button>
<input id="alertInputButton" type="button">An input button</input>
<input id="alertInputSubmit" type="submit">A submit button</input>
<input id="alertInputReset" type="reset">A reset button</input>
<input id="firstName" type="text"></input>
<input name="lastName" type="text"></input>
<input name="optIn" type="checkbox"></input>
```

Bind using this Javascript:

```javascript
Cu.Wire({
	view: {
		alertLink_Clicked: function () { alert('Link clicked.'); },
		alertButton_Clicked: function () { alert('Button clicked.'); },
		alertInputButton_Clicked: function () { alert('Input button clicked.'); },
		alertInputSubmit_Clicked: function () { alert('Input submit clicked.'); },
		alertInputReset_Clicked: function () { alert('Input reset clicked.'); },
		firstName_ViewChanged: function (newValue) {
			alert('firstName was changed to ' + newValue.toString());
		},
		lastName_ViewChanged: function (newValue) {
			alert('firstName was changed to ' + newValue.toString());
		},
		optIn_ViewChanged: function (newValue) {
			alert('firstName was changed to ' + newValue.toString());
		}
	}
});
```

Note that the handlers for the input element change events take an argument containing the new value of the element which you can use.

### Bind explicit View functions to the ViewModel

Instead of letting Copper bind straight through from HTML to ViewModel, you can put explicit handler functions on your View and let Copper bind your ViewModel to those. Simply follow the naming conventions below. These are the same conventions that Copper will use when generating implicit handlers on your View object. In short, take the name of the desired Observable property and add ```_ModelChanged```.

Example:

```javascript
Cu.Wire({
	model: {
		firstName: new Observable(''),
		lastName: new Observable(''),
		optIn: new Observable(false),
	},
	view: {
		firstName_ModelChanged: function (newValue) {
			alert('firstName in the ViewModel was changed to ' + newValue.toString());
		},
		lastName_ModelChanged: function (newValue) {
			alert('firstName in the ViewModel was changed to ' + newValue.toString());
		},
		optIn_ModelChanged: function (newValue) {
			alert('firstName in the ViewModel was changed to ' + newValue.toString());
		}
	}
});
```

Note that the handlers are just plain old Observable change event handlers, taking an argument containing the new value of the Observable which you can use.

### Manual binding hook

If you have some custom binding to do between your View and ViewModel, you can easily hook in at the end of the auto-binding process to receive the ViewModel object and do what you need to with it. When autobinding, Copper looks for a function on your View object called ```bindModel``` which is intended to take the ViewModel as an argument and store it in a field on the View. If none is provided, Copper will create one itself. If you include a ```bindModel``` method on your view, you take responsibility for storing the reference to the ViewModel, and have the opporutunity to do any last-minute manual binding or boookkeeping you desire. This most cleanly implemented when you have defined a View prototype ahead of time, so that you can make use of ```this```.

Example:

```javascript
var viewModel = {
	firstName: new Observable('')
};
	
var View = function() {
	this.prototype = {
		bindModel: function (viewModel) {
			this._model = viewModel;
			this._model.firstName.subscribe(function(newValue) {
				$('#givenName').val(newValue);
			});
		}
	};
};

Cu.Wire({
	model: viewModel,
	view: new View()
});
```

### Partial Views and Sub-Views with view scoping

If you decide that you want to use Copper to bind only a portion of your page, of if you want to compartmentalize your page into many smaller, simpler pieces with well-defined relationships, you can make use of Copper's support for view scoping to limit binding to occur within a subset of the DOM. All you need to do is provide a property on your View called ```$documentScope```, which contains a jQuery object identifying the scope of your view. When you do this, Copper will only bind within the elements specified by the ```$documentScope``` object. Note that the jQuery object could be a collection, not just a single element. If your handling need not distinguish between multiple identical parts of your page, just use a jQuery collection containing all of them.

Given the following HTML:

```html
<input id="trigger" type="button">Click Me</input>
<div id="container">
	<input id="name" type="text"></input>
</div>
```

Bind to the text box, but not the button, using this Javascript

```javascript
Cu.Wire({
	view: {
		$documentScope: $('#container'),
		trigger_Clicked: function() { alert('The button was clicked.'); },
		name_ViewChanged: function(newValue) { alert('The name was changed to ' + newValue); }
	}
});
```

After this code runs, if you click the button, nothing will happen. But after changing the name textbox, you will see an alert.

### View scope binding

If you find it useful at some point to use a micro-view for scope consisting solely of a series of buttons or input elements, it probably won't work to use IDs or names for binding. In this case, Copper provides a set of alternate conventions which will let you bind directly to the scope element itself, rather than a child of it. They work similarly to the other click and input change conventions, just with simpler property names.

Given the following HTML:

```html
<input id="trigger" type="button">Click Me</input>
```

Bind the button click, using this Javascript:

```javascript
Cu.Wire({
	view: {
		$documentScope: $('#trigger'),
		Clicked: function() { alert('The button was clicked.'); },
	}
});
```

Or to bind through to the ViewModel, use this Javascript:

```javascript
Cu.Wire({
	view: {
		$documentScope: $('#trigger')
	},
	model: {
		Click: function() { alert('The button was clicked.'); },
	}
});
```

Given the following HTML:

```html
<input id="firstName" type="text">/input>
```

Bind the value change event using this Javascript:

```javascript
Cu.Wire({
	view: {
		$documentScope: $('#firstName'),
		Value_Changed: function(newValue) { alert('The first name was set to ' + newValue.toString()); },
	}
});
```

Or to bind through to an Observable on the ViewModel, use this Javascript:

```javascript
Cu.Wire({
	view: {
		$documentScope: $('#firstName')
	},
	model: {
		Value: new Observable(''),
	}
});
```

### Selector-based binding

As stated in the beginning, Copper is built to help keeping your HTML and your ViewModel clean. Copper can help keep data out of your HTML attributes even in a table or list scenario where we might be tempted to add a ```data-``` to keep track of a domain model ID or something else we don't want displayed. It is probably clear by now that the first step to achieving this is to use scoping and micro-Views. But what if you have an ```ol``` and each ```li``` in it needs its own edit link? In the past you might have had one global handler and pulled the related ID out of an attribute. Or you'd have used generated ID attributes to identify one ```li``` from another. Or maybe you'd have hashed the IDs by their DOM or jQuery objects. With Copper, none of this is necessary. Once you've set up a document scope, just use a selector directive to indicate how to bind an Observable or click handler on your ViewModel to the DOM.

Say you have list populated via AJAX, and each item must contain a link which triggers a modal where you can edit the item's data. You might set that up with the HTML and script below. Note that this will work for input elements as well.

```html
<ul id="itemList"></ul>
```

```javascript
var itemData = retrieveItemsFromServer(); // Retrieve item data via AJAX.
var $list = $('#itemList');
var item = null;

for (int i = 0; i < itemData.length; ++i) {
	item = itemData[i];
	
	var ViewModel = {
		id: item.id,
		name: new Observable(item.name);
	};
	
	// Add a list item to the list dynamically
	var $item = $('<li><a class="editLink" href="#">' + item.name + '</a></li>');
	$list.append($item);
	
	Cu.Wire({
		view: {
			$documentScope: $item // Establish scope to be an individual list item
			selectorFor: {
				'edit' : 'a.editLink'
			}
		},
		model: {
			edit: function() {
				showEditModal(item);
			}
		}
	});
}
```

If you have other behavior on the page that you want to auto-bind, you might do the above work in the ```bindModel``` function of your page-level View. You might also consider using an ObservableCollection of item data or even item ViewModels to make this a bit less procedural. In a future release, I plan to provide autobinding to take care of infrastructure like this, and that will itself likely capitalize on ObservableCollection.

### Binding to the class attribute

Another simple permutation of the naming conventions can be used to bind ViewModel Observables to the class attribute of an element. You do this by establishing a series of boolean Observable properties representing the presence or absence of the class. Consider them to be "mode indicators" on your ViewModel. The naming follows a slightly different pattern in that in addition to the element's ID or name attribute value, the property name must also contain the class. The pattern for this is 'IdOrName_Is_Class'.

Given this HTML:

```html
<div id="userForm" class="">
	
</div>
```

Auto-bind an "invalid" class using this Javascript

```javascript
var viewModel = {
	userForm_Is_invalid: new Observable(false)
};

Cu.Wire({
	model: viewModel
});

viewModel.userForm_Is_invalid.val(true); // Adds the "invalid" class to the div.
viewModel.userForm_Is_invalid.val(false); // Removes the "invalid" class to the div.
```

## Future Auto-Binding Features

There are a number of features I plan to add to Copper in future releases. Generally they are all entered in the Issues list, but a few highlights include:

* Auto-bind the ```disabled``` attribute of input elements.
* Auto-bind ```ul```, ```ol```, and ```select``` children to an ObservableCollection
* Auto-bind any element repetition to an ObservableCollection
* Self-rendering views and template-based support for same.
* Generate a simple ViewModel "bag of observables" from a hash of initial values.
* Auto-initialization in either direction: from HTML to ViewModel, or from ViewModel to HTML.

_Stay tuned!_