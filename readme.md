#Intro

**copper.js** is a convention-based binding framework that flows between your HTML, view object, and view-model object and then wires them all up.

The primary goal of the current version of copper.js is to allow you to use a full-fledged MVVM implementation, but without much of the boilerplate that can often come along with such designs. To the extent possible, copper uses conventions to determine what events should be bound and what data should be synchronized. The default conventions are name-based. (At present, there is no way to change conventions without modifying copper's source, but easy convention overriding is on the way.)

The closer your objects follow the conventions in place, the slimmer your code can be, letting the business logic that departs from boilerplate semantics shine through.

#Features
* [Cu.Observable](https://github.com/cammerman/copper.js/wiki/Cu.Observable)
* [Cu.Computed](https://github.com/cammerman/copper.js/wiki/Cu.Computed)
* [Cu.ObservableCollection](https://github.com/cammerman/copper.js/wiki/Cu.ObservableCollection)
* [Cu.EventHost](https://github.com/cammerman/copper.js/wiki/Cu.EventHost)
* [Auto-Binding with Cu.Wire](https://github.com/cammerman/copper.js/wiki/Autobinding-with-Cu.Wire)

# Future Auto-Binding Features

There are a number of features I plan to add to Copper in future releases. Generally they are all entered in the Issues list, but a few highlights include:

* Auto-bind the ```disabled``` attribute of input elements.
* Auto-bind ```ul```, ```ol```, and ```select``` children to an ObservableCollection
* Auto-bind any element repetition to an ObservableCollection
* Self-rendering views and template-based support for same.
* Generate a simple ViewModel "bag of observables" from a hash of initial values.
* Cu.Bindable: Bindable properties that are read-only via ```.val()``` and not observable, for syuncing on init only.

_Stay tuned!_