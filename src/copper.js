/*
    copper.js
    Author: Chris Ammerman
    License: New BSD License (http://www.opensource.org/licenses/bsd-license.php)
    Version 0.7
*/
Cu  = (function($, undefined) {
	var Observable,
		Computed,
		ObservableCollection,
		EventHost,
		SmartEvent,
		View,
		BindPipelineStep,
		BindPipeline,
		ModelPropertyBindPipeline,
		Extender,
		Conventions,
		Select;
	
	Select = (function () {
		var construct = function() {};
	
		construct.prototype = {
			inScope: function ($scope, selector) {
				if (selector === undefined) {
					return undefined;
				}

				if ($scope) {
					return $scope.find(selector).add($scope.filter(selector))
				}

				return $(selector);
			},

			inView: function (view, id) {
				return this.inScope(view.$documentScope, '#' + id);
			}
		};
		
		return new construct();
	})();
	
	Extender = {
		extend: function (target, source, preserveExisting) {
			for (var prop in source) {
				if (source.hasOwnProperty(prop)
					&& (!preserveExisting
						|| target[prop] == undefined)) {
					target[prop] = source[prop];
				}
			}
		},
		extendDeep: function (target, source, preserveExisting) {
			for (var prop in source) {
				if (!preserveExisting || target[prop] == undefined) {
					target[prop] = source[prop];
				}
			}
		},
		extendPrototype: function (baseConstructor, extensions) {
			var derived = new baseConstructor(),
				prop;

			for (prop in derived) {
				if (typeof derived[prop] !== 'function') {
					derived[prop] = undefined;
				}
			}

			for (var prop in extensions) {
				derived[prop] = extensions[prop];
			}

			return derived;
		}
	};

	SmartEvent = (function () {
		var construct = function (name) {
			this.name = name;
			this.handlers = [];
		};

		construct.prototype = {
			subscribe: function (handler) {
				if (typeof handler === 'function' && !_(this.handlers).include(handler)) {
					this.handlers.push(handler);
				}
			},
			unsubscribe: function (handler) {
				if (typeof handler === 'function') {
					this.handlers = _(this.handlers).without(handler);
				}
			},
			raise: function () {
				var args = Array.prototype.slice.call(arguments);

				_(this.handlers).each(function (handler) {
					handler.apply(handler, args);
				});
			},
			release: function () {
				this.handlers = [];
			}
		};

		return construct;
	})();

	EventHost = (function () {
		var construct = function (eventNames) {
			var scope = this;

			scope._events = {};
			
			_(eventNames || []).forEach(function (eventName) {
				scope._events[eventName] = new SmartEvent(eventName);
			});
		};

		construct.prototype = {
			_subscribe: function (eventName, handler) {
				var theEvent = this._events[eventName];

				if (theEvent instanceof SmartEvent) {
					theEvent.subscribe(handler);
				}
			},
			_bulkSubscribe: function (handlers) {
				var eventName;

				for (eventName in handlers) {
					this._subscribe(eventName, handlers[eventName]);
				}
			},
			subscribe: function () {
				if (arguments.length == 0) {
					return;
				}

				if (typeof arguments[0] == 'string') {
					this._subscribe.apply(this, arguments);
				} else if (typeof arguments[0] == 'object') {
					this._bulkSubscribe.apply(this, arguments);
				}
			},
			unsubscribe: function (eventName, handler) {
				var theEvent = this._events[eventName];

				if (theEvent instanceof SmartEvent) {
					theEvent.unsubscribe(handler);
				}
			},
			raise: function () {
				var scope = this,
					args = Array.prototype.slice.call(arguments);

				if (args.length == 0) {
					return;
				}

				var theEvent = scope._events[args[0]];

				if (theEvent instanceof SmartEvent) {
					theEvent.raise.apply(theEvent, args.slice(1));
				}
			},
			release: function () {
				var eventName;

				if (arguments.length == 0) {
					for (eventName in this._events) {
						this._events[eventName].release();
					}
				}
			}
		};

		return construct;
	})();

	Observable = (function () {
		var construct = function (newValue) {
			this._subscriptions = this._subscriptions || [];
			this._value = (newValue == undefined) ? null : newValue;
		};

		construct.prototype = {
			val: function (newValue) {
				if (newValue === undefined) {
					return this._value;
				} else {
					if (this._value != newValue) {
						this._value = newValue;
						this._notify(newValue);
					}
				}
			},
			
			subscribe: function (handler) {
				this._subscriptions.push(handler);
			},

			unsubscribe: function (handler) {
				if (typeof handler === 'function') {
					this._subscriptions = _(this._subscriptions).without(handler);
				}
			},

			release: function () {
				this._subscriptions = [];
			},

			_notify: function (newValue) {
				_(this._subscriptions).forEach(function (handler) {
					handler(newValue);
				});
			},
			
			notify: function () {
				this._notify(this._value);
			},
			
			as: function (transform) {
				var dependent = new Computed({
					from: this,
					as: transform
				});
				
				return dependent;
			},
			
			when: function (filter) {
				var dependent = new Computed({
					from: this,
					when: filter
				});
				
				return dependent;
			}
		};

		return construct;
	})();
	
	Computed = (function () {

		var construct = function (init) {
			var scope = this,
				initialValues = [];

			Observable.call(scope);

			if (init.from instanceof Array) {
				scope._dependentOn = init.from;
			} else if (init.from === undefined || init.from === null)
				scope._dependentOn = [];
			else {
				scope._dependentOn = [init.from];
			}

			_(scope._dependentOn).forEach(function (source) {
				source.subscribe(function (newValue) {
					scope._listen.apply(scope, _(scope._dependentOn).map(function (dependency) {
						if (dependency == source && newValue) {
							return newValue;
						} else {
							return dependency.val();
						}
					}));

					// Only pass the value through if this is the sole source for the computation.
					//scope._listen((scope._dependentOn.length == 1) ? newValue : undefined);
				});
			});

			scope._when = init.when || function () { return true; };
			scope._transform = init.as || function (newValue) { return newValue; };

			initialValues = _(scope._dependentOn).map(function (dependency) { return dependency.val(); });
			scope._syncValue.apply(scope, initialValues);
		};

		construct.prototype = Extender.extendPrototype(Observable, {
			_listen: function () {
				if (this._when.apply(this, Array.prototype.slice.call(arguments))) {
					this._syncValue.apply(this, Array.prototype.slice.call(arguments));
					this._notify(this._value);
				}
			},

			_syncValue: function () {
				this._value = this._transform.apply(this, Array.prototype.slice.call(arguments));
			},

			dependentOn: function (reference) {
				var scope = this;

				if (reference === undefined) {
					return _.clone(scope._dependentOn);
				} else {
					return _(scope._dependentOn).any(function (dependency) {
						return (dependency == scope) || (dependency instanceof Computed && dependency.dependentOn(scope));
					});
				}
			},

			val: function () {
				return this._value;
			}
		});

		return construct;
	})();

	ObservableCollection = (function () {
		var construct = function (initialValue) {
			EventHost.call(this, ['collectionReplaced', 'itemAdded', 'itemRemoved']);

			if (initialValue instanceof Array) {
				this._value = initialValue;
			} else {
				this._value = [];
			}
		};

		construct.prototype = Extender.extendPrototype(EventHost, {
			val: function (newValue) {
				if (newValue === undefined) {
					return this._value;
				} else {
					if (!(newValue instanceof Array)) {
						return;
					}

					if (this._value != newValue) {
						this._value = newValue;
						this.raise('collectionReplaced', newValue);
					}
				}
			},
			add: function (newItem, index) {
				var indexAtEnd;

				if (index == undefined) {
					indexAtEnd = this._value.length;
					this._value.push(newItem);
					this.raise('itemAdded', newItem, indexAtEnd);
				} else {
					this._value.splice(index, 0, newItem);
					this.raise('itemAdded', newItem, index);
				}
			},
			remove: function (item) {
				var index = _(this._value).indexOf(item);
				if (index != -1) {
					this.removeAt(index);
				}
			},
			removeAt: function (index) {
				var sliced = this._value.slice(index + 1),
					item = this._value[index];

				this._value.length = index;
				// Calls Array.push with the items after the removed item as the argument array.
				this._value.push.apply(this._value, sliced);

				this.raise('itemRemoved', item, index);
			}
		});

		return construct;
	})();
	
	Conventions = {
		inputSelector: 'select, input[type!=button][type!=reset][type!=file][type!=checkbox][type!=radio]',
		checkableSelector: 'input[type=checkbox], input[type=radio]',
		clickableSelector: 'a, button, input[type=submit], input[type=button], input[type=reset]'
	};
	
	InputBinding = (function () {
		var construct = function (view) {
			this._view = view;
		};
		
		construct.prototype = {
			_isClickable: function ($element) {
				return $element.is(Conventions.clickableSelector);
			},

			_isInput: function ($element) {
				return $element.is(Conventions.inputSelector);
			},
			
			_isCheckable: function ($element) {
				return $element.is(Conventions.checkableSelector);
			},
			
			_isClickable: function ($element) {
				return $element.is(Conventions.clickableSelector);
			},
			
			_createClickCallback: function(view, propertyName) {
				var self = this;
				
				return function (e) {
					if (self._inputType.clickable && e.preventDefault != undefined) {
						e.preventDefault();
					}
					
					view[propertyName].apply(view, arguments);
				};
			},
			
			_createChangeCallback: function(view, propertyName) {
				return function () {
					view[propertyName].apply(view, arguments);
				};
			},
			
			source: function () {
				return this._source;
			},
			
			target: function () {
				return this._target;
			},
			
			inputType: function () {
				return this._inputType;
			},
			
			bind: function ($elements, propertyName) {
				var inputType = {
					input: this._isInput($elements),
					checkable: this._isCheckable($elements),
					clickable: this._isClickable($elements)
				};
				
				if (inputType.input || inputType.checkable || inputType.clickable) {
					this._source = $elements;
					this._target = propertyName;
					
					this._inputType = inputType;
					
					if (this._inputType.checkable || this._inputType.clickable) {
						this._callback = this._createClickCallback(this._view, propertyName);
						$elements.click(this._callback);
					} else if (this._inputType.input) {
						this._callback = this._createChangeCallback(this._view, propertyName);
						$elements.change(this._callback);
					}
				}
			},
			
			release: function () {
				if (this._inputType.checkable || this._inputType.clickable) {
					this._source.unbind('click', this._callback);
				} else {
					this._source.unbind('change', this._callback);
				}
					
				this._source = undefined;
				this._target = undefined;
				this._callback = undefined;
			},
			
			trigger: function () {
				if (this._inputType.checkable || this._inputType.clickable) {
					this._source.trigger('click');
				} else {
					this._source.trigger('change');
				}
			}
		};
		
		return construct;
	})();
	
	ModelBinding = (function () {
		var construct = function (view, model) {
			this._view = view;
			this._model = model;
		};
		
		construct.prototype = {
			_createClickCallback: function (view, propertyName) {
				return function (e) {
					if (e.preventDefault != undefined) {
						e.preventDefault();
					}
					
					view[propertyName].apply(view, arguments);
				};
			},
			
			_createChangeCallback: function(view, propertyName) {
				return function () {
					view[propertyName].apply(view, arguments);
				};
			},
			
			source: function () {
				return this._source;
			},
			
			target: function () {
				return this._target;
			},
			
			bind: function (modelProperty, viewPropertyName) {
				var property = this._model[modelProperty];
				
				this._source = modelProperty;
				this._target = viewPropertyName;
				
				if (property instanceof Observable) {
					this._callback = this._createChangeCallback(this._view, viewPropertyName);
					property.subscribe(this._callback);
				}
			},
			
			release: function () {
				this._model[this._source].unsubscribe(
					this._view[this._target]);
					
				this._model = undefined;
				this._source = undefined;
				this._target = undefined;
				this._callback = undefined;
			},
			
			trigger: function () {
				this._model[this._source].notify();
			}
		};
		
		return construct;
	})();

	BindPipelineStep = (function () {
		var construct = function (strategy) {
			Extender.extend(this, strategy);
		};

		construct.prototype = {
			tryBind: function (view, model) { return false; },
			
			_isClickable: function ($element) {
				return $element.is(Conventions.clickableSelector);
			},

			_isInput: function ($element) {
				return $element.is(Conventions.inputSelector);
			},
			
			_isCheckable: function ($element) {
				return $element.is(Conventions.checkableSelector);
			}
		};

		return construct;
	})();
	
	var BindPipelineStepException = (function () {
		var construct = function (init) {
			this.message = init.message;
			this.subject = init.subject;
			this.member = init.member;
		}
		
		return construct;
	})();
	
	var BindModelPropertyStep = (function () {
		var construct = function (strategy) {
			Extender.extend(this, strategy);
		};
		
		construct.prototype = new BindPipelineStep({
			tryBindProperty: function(view, model, propertyName) {
				throw new BindPipelineStepException({
					message: 'Model property binding step is not implemented.',
					subject: model,
					member: propertyName
				});
			}
		});
		
		return construct;
	})();
	
	var BindModelObservablePropertyToViewHandler = (function () {
		var construct = function () { };
		
		construct.prototype = new BindModelPropertyStep({
		
			tryBindProperty: function (view, model, propertyName) {
				var property = model[propertyName],
					handler;

				if (property instanceof Observable) {
					return this._tryBindChangeEvent(view, model, property, propertyName);
				}
				
				return false;
			},
			
			_tryBindChangeEvent: function (view, model, property, propertyName) {
				var scope = this,
					binding,
					handlerName = propertyName + '_ModelChanged';

				if (view[handlerName] != undefined) {
					binding = new ModelBinding(view, model);
					binding.bind(propertyName, handlerName);
					
					view._modelBindings.push(binding);
				
					return true;
				}
				
				return false;
			}
		});
		
		return construct;
	})();
	
	var BindModelObservablePropertyToInput = (function () {
		var construct = function (strategy) {
			Extender.extend(this, strategy);
		};
		
		construct.prototype = new BindModelPropertyStep({
		
			tryBindProperty: function (view, model, propertyName) {
				var property = model[propertyName],
					handler;

				if (property instanceof Observable) {
					return this._tryBindElement(view, model, propertyName);
				}
				
				return false;
			},
			
			_findBindableElement: function (view, propertyName) {
				var conventionIndex = 0,
					$element;
				
				while (conventionIndex < FindBindableElementPipeline.length && !this._elementFound($element)) {
					$element = FindBindableElementPipeline[conventionIndex](view, propertyName);
					++conventionIndex;
				}
				
				return $element;
			},
			
			_elementFound: function ($element) {
				return $element && $element.length > 0;
			},
			
			_tryBindElement: function (view, model, propertyName) {
				var $element = this._findBindableElement(view, propertyName);
				
				if (this._elementFound($element)) {
					if (this._tryBindInputToObservableProperty(view, model, $element, propertyName)) {
						return true;
					}
				}

				return false;
			},
			
			_tryBindInputToObservableProperty: function (view, model, $element, propertyName) {
				var scope = this,
					handlerName = propertyName + '_ModelChanged',
					callback,
					binding;
					
				if (scope._isInput($element)) {
					callback = function (newValue) {
						$element.val(newValue);
					};
				} else if (scope._isCheckable($element)) {
					callback = function (newValue) {
						$element.attr('checked', newValue);
					};
				}

				if (callback != undefined) {
					view[handlerName] = callback;
					
					binding = new ModelBinding(view, model);
					binding.bind(propertyName, handlerName);
					
					view._modelBindings.push(binding);
					
					return true;
				}

				return false;
			}
		});
		
		return construct;
	})();
	
	var FindBindableElement = {
		byReference: function(view, propertyName) {
			var reference = view[propertyName];
			
			if (reference instanceof jQuery) {
				return reference;
			}
			
			return null;
		},
		
		byNamedReference: function(view, propertyName) {
			var reference;
			
			if (!view.referenceFor) {
				return null;
			}
			
			reference = view.referenceFor[propertyName];
			
			if (reference instanceof jQuery) {
				return reference;
			}
			
			return null;
		},
		
		bySelector: function(view, propertyName) {
			if (!view.selectorFor) {
				return null;
			}
			
			return Select.inScope(view.$documentScope, view.selectorFor[propertyName]);
		},
		
		byId: function (view, propertyName) {
			return Select.inView(view, propertyName);
		},
		
		byName: function (view, propertyName) {
			return Select.inScope(view.$documentScope, 'input[name="' + propertyName + '"]');
		}
	};
	
	// TODO: Consolidate both directions of each convention.
	
	var FindBindableContentElementPipeline = [
		FindBindableElement.byReference,
		FindBindableElement.byNamedReference,
		FindBindableElement.bySelector,
		FindBindableElement.byId
	];
	
	var FindBindableElementPipeline = [
		FindBindableElement.byReference,
		FindBindableElement.byNamedReference,
		FindBindableElement.bySelector,
		FindBindableElement.byId,
		FindBindableElement.byName
	];

	var BindModelObservablePropertyToClass = (function () {
		var construct = function (strategy) {
			Extender.extend(this, strategy);
		};
		
		construct.prototype = new BindModelPropertyStep({
		
			tryBindProperty: function (view, model, propertyName) {
				var property = model[propertyName],
					handler;

				if (property instanceof Observable && propertyName.length > 0) {
					return this._tryBindElement(view, model, propertyName);
				}
				
				return false;
			},
			
			_elementFound: function ($element) {
				return $element && $element.length > 0;
			},
			
			_findBindableElement: function (view, propertyNameId) {
				var conventionIndex = 0,
					$element;
				
				while (conventionIndex < FindBindableElementPipeline.length && !this._elementFound($element)) {
					$element = FindBindableElementPipeline[conventionIndex](view, propertyNameId);
					++conventionIndex;
				}
				
				return $element;
			},
			
			_tryBindElement: function (view, model, propertyName) {
				var $element,
					lengthOfId = propertyName.indexOf('_Is_'),
					startOfClass = lengthOfId + 4,
					id,
					mode;
				
				if (lengthOfId > 0 && startOfClass < propertyName.length) {
					id = propertyName.substr(0, lengthOfId);
					$element = this._findBindableElement(view, id);

					if ($element && $element.length > 0) {
						if (this._tryBindClassToObservableProperty(view, model, $element, propertyName, startOfClass)) {
							return true;
						}
					}
				}

				return false;
			},
			
			_tryBindClassToObservableProperty: function (view, model, $element, propertyName, startOfClass) {
				var scope = this,
					binding,
					handlerName = propertyName + '_ModelChanged',
					mode = propertyName.slice(startOfClass),
					callback;
					
				if (mode.length > 0) {
					callback = function (newValue) {
						if (newValue) {
							$element.addClass(mode);
						} else {
							$element.removeClass(mode);
						}
					};
					
					view[handlerName] = callback;
					
					binding = new ModelBinding(view, model);
					binding.bind(propertyName, handlerName);
					
					view._modelBindings.push(binding);
					
					return true;
				}
				
				return false;
			}
		});
		
		return construct;
	})();
	
	var BindModelObservablePropertyToContent = (function () {
		var construct = function (strategy) {
			Extender.extend(this, strategy);
		};
		
		construct.prototype = new BindModelPropertyStep({
		
			_elementFound: function ($element) {
				return $element && $element.length > 0;
			},
			
			_findBindableElement: function (view, propertyNameId) {
				var conventionIndex = 0,
					$element;
				
				while (conventionIndex < FindBindableContentElementPipeline.length && !this._elementFound($element)) {
					$element = FindBindableContentElementPipeline[conventionIndex](view, propertyNameId);
					++conventionIndex;
				}
				
				return $element;
			},
			
			tryBindProperty: function (view, model, propertyName) {
				var property = model[propertyName],
					handler;

				if (property instanceof Observable) {
					return this._tryBindElement(view, model, propertyName);
				}
				
				return false;
			},
			
			_tryBindElement: function (view, model, propertyName) {
				$element = this._findBindableElement(view, propertyName);

				if ($element && $element.length > 0) {
					if (!this._isInput($element) && !this._isCheckable($element)) {
						this._bindContent(view, model, $element, propertyName);
						
						return true;
					}
				}

				return false;
			},
						
			_bindContent: function (view, model, $element, propertyName) {
				var callback = function (newValue) {
					$element.html(newValue);
				},
					handlerName = propertyName + '_ModelChanged',
					binding;

				view[handlerName] = callback;

				binding = new ModelBinding(view, model);
				binding.bind(propertyName, handlerName);
				
				view._modelBindings.push(binding);
			}
		});
		
		return construct;
	})();
	
	var BindModelObservablePropertyToInputScope = (function () {
		var construct = function () { };
		
		construct.prototype = new BindModelPropertyStep({
		
			tryBindProperty: function (view, model, propertyName) {
				var property = model[propertyName],
					handler;

				if (property instanceof Observable) {
					return this._tryBindScopeElement(view, model, propertyName);
				}
				
				return false;
			},
			
			_tryBindScopeElement: function (view, model, propertyName) {
				$element = view.$documentScope;

				if (propertyName == 'Value' && $element) {
					if (this._tryBindInputToObservableProperty(view, model, $element, propertyName)) {
						return true;
					}
				} else if (propertyName.indexOf('Is_') == 0) {
					if (this._tryBindElementToObservableMode(view, model, $element, propertyName, propertyName.slice(3))) {
						return true;
					}
				}

				return false;
			},
			
			_bindToModel: function (view, model, handlerName, propertyName) {
				var binding;
				
				binding = new ModelBinding(view, model);
				binding.bind(propertyName, handlerName);
				
				view._modelBindings.push(binding);
			},
			
			_tryBindInputToObservableProperty: function (view, model, $element, propertyName) {
				var scope = this,
					handlerName = propertyName + '_ModelChanged',
					callback;
					
				if (scope._isInput($element)) {
					callback = function (newValue) {
						$element.val(newValue);
					};
				} else if (scope._isCheckable($element)) {
					callback = function (newValue) {
						$element.attr('checked', newValue);
					};
				}

				if (callback) {
					view[handlerName] = callback;
					this._bindToModel(view, model, handlerName, propertyName);
					
					return true;
				}

				return false;
			},
			
			_tryBindElementToObservableMode: function (view, model, $element, propertyName, mode) {
				var scope = this,
					handlerName = propertyName + '_ModelChanged',
					callback;
					
				callback = function (newValue) {
					if (newValue) {
						$element.addClass(mode);
					} else {
						$element.removeClass(mode);
					}
				};

				if (callback) {
					view[handlerName] = callback;
					this._bindToModel(view, model, handlerName, propertyName);
					
					return true;
				}

				return false;
			}
		});
		
		return construct;
	})();
	
	var BindModelObservablePropertyToInputContent = (function () {
		var construct = function () { };
		
		construct.prototype = new BindModelPropertyStep({
		
			tryBindProperty: function (view, model, propertyName) {
				var property = model[propertyName],
					handler;

				if (property instanceof Observable) {
					return this._tryBindScopeElement(view, model, propertyName);
				}
				
				return false;
			},
			
			_tryBindScopeElement: function (view, model, propertyName) {
				$element = view.$documentScope;

				if (propertyName == 'Value' && $element) {
					if (this._isInput($element)) {
						return this._bindContent(view, model, $element, propertyName);
					}
				}

				return false;
			},
			
			_bindContent: function (view, model, $element, propertyName) {
				var callback = function (newValue) {
						$element.html(newValue);
					},
					handlerName = propertyName + '_ModelChanged',
					binding;

				view[handlerName] = callback;

				binding = new ModelBinding(view, model);
				binding.bind(propertyName, handlerName);
				
				view._modelBindings.push(binding);
			}
		});
		
		return construct;
	})();
	
	var FindBindableClickableElementPipeline = [
		FindBindableElement.byReference,
		FindBindableElement.byNamedReference,
		FindBindableElement.bySelector,
		FindBindableElement.byId,
		FindBindableElement.byName
	];
	
	var BindModelFunctionPropertyToClickable = (function () {
		var construct = function (strategy) {
			Extender.extend(this, strategy);
		};
		
		construct.prototype = new BindModelPropertyStep({
		
			_findBindableElement: function (view, propertyName) {
				var conventionIndex = 0,
					$element;
				
				while (conventionIndex < FindBindableClickableElementPipeline.length && !this._elementFound($element)) {
					$element = FindBindableClickableElementPipeline[conventionIndex](view, propertyName);
					++conventionIndex;
				}
				
				return $element;
			},
			
			_elementFound: function ($element) {
				return $element && $element.length > 0;
			},
			
			tryBindProperty: function (view, model, propertyName) {
				var property = model[propertyName],
					handler;

				if (typeof property == 'function') {
					handler = function (e) {
						if (e && (typeof e.preventDefault == 'function')) {
							e.preventDefault();
						}

						property.call(model);
					};
					
					return this._tryBindClick(view, propertyName, handler);
				}
				
				return false;
			},
			
			_tryBindClick: function (view, propertyName, callback) {
				$element = this._findBindableElement(view, propertyName);

				if ($element && $element.length > 0 && this._isClickable($element)) {
					this._bindClick(view, $element, propertyName, callback);
					return true;
				}

				return false;
			},
			
			_bindClick: function (view, $element, propertyName, callback) {
				var handler,
					binding,
					handlerName = propertyName + '_Clicked';

				handler	= function (e) {
					callback(e);
				};

				view[handlerName] = handler;

				binding = new InputBinding(view);
				binding.bind($element, handlerName);
				
				view._inputBindings.push(binding);
			}
		});
		
		return construct;
	})();
	
	var BindModelFunctionPropertyToClickableScope = (function () {
		var construct = function () { };
		
		construct.prototype = new BindModelPropertyStep({
		
			tryBindProperty: function (view, model, propertyName) {
				var property = model[propertyName],
					handler;

				if (typeof property == 'function') {
					handler = function (e) {
						if (e && (typeof e.preventDefault == 'function')) {
							e.preventDefault();
						}

						property.call(model);
					};
					
					return this._tryBindScopeClick(view, propertyName, handler);
				}
				
				return false;
			},
			
			_tryBindScopeClick: function (view, propertyName, callback) {
				$element = view.$documentScope;

				if (propertyName == 'Click' && $element && $element.length > 0 && this._isClickable($element)) {
					this._bindScopeClick(view, $element, callback);
					return true;
				}

				return false;
			},
			
			_bindScopeClick: function (view, $element, callback) {
				var handlerName = 'Clicked',
					handler,
					binding;
				
				handler = function (e) {
					callback(e);
				};

				view[handlerName] = handler;

				binding = new InputBinding(view);
				binding.bind($element, handlerName);
				
				view._inputBindings.push(binding);
			}
		});
		
		return construct;
	})();
	
	ModelPropertyBindPipeline = [
		new BindModelObservablePropertyToViewHandler(),
		new BindModelObservablePropertyToInput(),
		new BindModelObservablePropertyToClass(),
		new BindModelObservablePropertyToContent(),
		new BindModelObservablePropertyToInputScope(),
		new BindModelObservablePropertyToInputContent(),
		new BindModelFunctionPropertyToClickable(),
		new BindModelFunctionPropertyToClickableScope()
	];
	
	var BindHtmlElementStep = (function () {
		var construct = function (strategy) {
			Extender.extend(this, strategy);
		};
		
		construct.prototype = new BindPipelineStep({
			_tryBindElement: function(view, model, $el) {
				var member;
				
				if ($el) {
					member = $el.attr('id');
				}
				
				throw new BindPipelineStepException({
					message: 'Html element binding step is not implemented.',
					subject: view.$documentScope,
					member: member || this._selector
				});
			},
			
			tryBind: function(view, model, state) {
				var scope = this,
					propertyName;
				
				_(Select.inScope(view.$documentScope, scope._selector))
					.forEach(function (element) {
						var $el = $(element),
							alreadyBound = _(state.boundViewElements).any(function ($boundEl) {
								return $el.is($boundEl);
							});

						if (!alreadyBound) {
							if (scope._tryBindElement(view, model, $el)) {
								state.boundViewElements.push($el);
							}
						}
					});
			}
		});
		
		return construct;
	})();
	
	var BindModelPropertiesStep = (function () {
		var construct = function (strategy) {
			Extender.extend(this, strategy);
		};
		
		construct.prototype = new BindPipelineStep({
			tryBind: function(view, model, state) {
				var scope = this,
					propertyName;

				for (propertyName in model) {
					_(ModelPropertyBindPipeline).forEach(function (step) {
						if (!_(state.boundModelProperties).include(propertyName)) {
							if (step.tryBindProperty(view, model, propertyName)) {
								state.boundModelProperties.push(propertyName);
							}
						}
					});
				}
			}
		});
		
		return construct;
	})();
	
	var PrepareBindingListsStep = (function () {
		var construct = function () { };
		
		construct.prototype = new BindPipelineStep({
			tryBind: function (view, model) {
				if (view._inputBindings == undefined || !(view._inputBindings instanceof Array)) {
					view._inputBindings = [];
				}
				
				if (view._modelBindings == undefined || !(view._modelBindings instanceof Array)) {
					view._modelBindings = [];
				}
			}
		});
		
		return construct;
	})();
	
	var BindInputsByIdToViewHandlersStep = (function () {
		var construct = function () {
			this._selector = [Conventions.inputSelector, Conventions.checkableSelector].join(',');
		};
		
		construct.prototype = new BindHtmlElementStep({
			_tryBindElement: function (view, model, $el) {
				var id = $el.attr('id'),
					handlerName = id + '_ViewChanged',
					binding;

				if (id != undefined && view[handlerName] != undefined) {
					if (this._isInput($el) || this._isCheckable($el)) {
						binding = new InputBinding(view);
						binding.bind($el, handlerName);
						view._inputBindings.push(binding);
					}
					
					return true;
				}
				
				return false;
			}
		});
		
		return construct;
	})();
	
	var BindInputsByNameToViewHandlersStep = (function () {
		var construct = function () {
			this._selector = [Conventions.inputSelector, Conventions.checkableSelector].join(',');
		};
		
		construct.prototype = new BindHtmlElementStep({
			_tryBindElement: function (view, model, $el) {
				var id = $el.attr('name'),
					handlerName = id + '_ViewChanged',
					binding;

				if (id != undefined && view[handlerName] != undefined) {
					if (this._isInput($el) || this._isCheckable($el)) {
						binding = new InputBinding(view);
						binding.bind($el, handlerName);
						view._inputBindings.push(binding);
					}
					
					return true;
				}
				
				return false;
			}
		});
		
		return construct;
	})();
	
	var BindViewScopeElementToModelStep = (function () {
		var construct = function () { }
		
		construct.prototype = new BindPipelineStep({		
			tryBind: function(view, model, state) {
				if (view.$documentScope) {
					this._tryBindInputScopeToModel(view, view.$documentScope, model);
				}
			},
			
			_tryBindInputScopeToModel: function (view, $scopeElement, model) {
				var property = model['Value'];
				
				if (property != undefined) {
					if (property instanceof Observable) {
						this._bindOvervablePropertyToInput(view, $scopeElement, property);
						return true;
					} else if (typeof property != 'function') {
						this._bindSimplePropertyToInput(view, $scopeElement, model);
						return true;
					}
				}

				return false;
			},
			
			_bindInput: function (view, $element, handlerName) {
				var binding = new InputBinding(view);
				binding.bind($element, handlerName);
				view._inputBindings.push(binding);
			},
			
			_bindOvervablePropertyToInput: function (view, $scopeElement, property) {
				var handlerName = 'Value_ViewChanged',
					callback;
					
				if (this._isInput($element)) {
					callback = function (e) {
						property.val($(e.target).val());
					};

					view[handlerName] = callback;
				} else if (this._isCheckable($element)) {
					callback = function (e) {
						property.val($(e.target).is(':checked'));
					};

					view[handlerName] = callback;
				}
				
				if (callback !== undefined) {
					this._bindInput(view, $scopeElement, handlerName);
				}
			},

			_bindSimplePropertyToInput: function (view, $scopeElement, model) {
				var handlerName = 'Value_ViewChanged',
					callback;

				if (this._isInput($element)) {
					callback = function (e) {
						model['Value'] = $(e.target).val();
					};

					view[handlerName] = callback;
				} else if (this._isCheckable($element)) {
					callback = function (e) {
						model['Value'] = $(e.target).is(':checked');
					};

					view[handlerName] = callback;
				}
				
				if (callback !== undefined) {
					this._bindInput(view, $scopeElement, handlerName);
				}
			}
		});
		
		return construct;
	})();
	
	var BindInputsToModelStep = (function () {
		var construct = function (strategy) {
			Extender.extend(this, strategy);
			this._selector = [Conventions.inputSelector, Conventions.checkableSelector].join(',');
		};
		
		construct.prototype = new BindHtmlElementStep({
			_tryBindElement: function (view, model, $el) {
				return this._tryBindInputToModel(view, $el, model);
			},
			
			_propertyName: function ($element, view) {
				var conventionIndex = 0,
					propertyName;
				
				while (conventionIndex < FindBindablePropertyNamePipeline.length && (propertyName === null || propertyName === undefined)) {
					propertyName = FindBindablePropertyNamePipeline[conventionIndex]($element, view);
					++conventionIndex;
				}
				
				return propertyName;
			},
			
			_tryBindInputToModel: function (view, $element, model) {
				
				var propertyName = this._propertyName($element, view);
				
				var property = model[propertyName];

				if (propertyName != undefined && property != undefined) {
					if (property instanceof Observable) {
						this._bindOvervablePropertyToInput(view, $element, property, propertyName);
						return true;
					} else if (typeof property != 'function') {
						this._bindSimplePropertyToInput(view, $element, model, propertyName);
						return true;
					}
				}

				return false;
			},
			
			_bindInput: function (view, $element, handlerName) {
				var binding = new InputBinding(view);
				binding.bind($element, handlerName);
				view._inputBindings.push(binding);
			},

			_bindOvervablePropertyToInput: function (view, $element, property, propertyName) {
				var handlerName = propertyName + '_ViewChanged',
					callback;
					
				if (this._isInput($element)) {
					callback = function (e) {
						property.val($(e.target).val());
					};

					view[handlerName] = callback;		
					
					this._bindInput(view, $element, handlerName);
				} else if (this._isCheckable($element)) {
					callback = function (e) {
						property.val($(e.target).is(':checked'));
					};

					view[handlerName] = callback;
					
					this._bindInput(view, $element, handlerName);
				}
			},

			_bindSimplePropertyToInput: function (view, $element, model, propertyName) {
				var handlerName = propertyName + '_ViewChanged',
					callback;

				if (this._isInput($element)) {
					callback = function (e) {
						model[propertyName] = $(e.target).val();
					};

					view[handlerName] = callback;		
					
					this._bindInput(view, $element, handlerName);
				} else if (this._isCheckable($element)) {
					callback = function (e) {
						model[propertyName] = $(e.target).is(':checked');
					};

					view[handlerName] = callback;
					
					this._bindInput(view, $element, handlerName);
				}
			}
		});
		
		return construct;
	})();
	
	var FindBindablePropertyName = {
		byReference: function ($element, view) {
			var propertyName,
				reference;
			
			for (propertyName in view) {
				reference = view[propertyName];
				
				if (reference instanceof jQuery && $element.is(reference)) {
					return propertyName;
				}
			}

			return undefined;
		},
		
		byNamedReference: function ($element, view) {
			var propertyName,
				reference;
			
			if (!view.referenceFor) {
				return null;
			}
			
			for (propertyName in view.referenceFor) {
				reference = view.referenceFor[propertyName];
				
				if (reference instanceof jQuery && $element.is(reference)) {
					return propertyName;
				}
			}

			return undefined;
		},
		
		bySelector: function ($element, view) {
			var selectorFor = view.selectorFor,
				propertyName;
			
			for (propertyName in view.selectorFor) {
				if ($element.is(selectorFor[propertyName])) {
					return propertyName;
				}
			}

			return undefined;
		},
		
		byId: function ($element, view) {
			return $element.attr('id');
		},
		
		byName: function ($element, view) {
			return $element.attr('name');
		}
	};
	
	// TODO: Consolidate both directions of each convention.
	
	var FindBindablePropertyNamePipeline = [
		FindBindablePropertyName.byReference,
		FindBindablePropertyName.byNamedReference,
		FindBindablePropertyName.bySelector,
		FindBindablePropertyName.byId,
		FindBindablePropertyName.byName
	];
	
	var BindClickablesToViewHandlersStep = (function () {
		var construct = function () {
			this._selector = Conventions.clickableSelector;
		};
		
		construct.prototype = new BindHtmlElementStep({
			_tryBindElement: function (view, model, $el) {
				var id = $el.attr('id'),
					handlerName = id + '_Clicked',
					callback;
					
				if (id != undefined && view[handlerName] != undefined) {
					binding = new InputBinding(view);
					binding.bind($el, handlerName);
					view._inputBindings.push(binding);

					return true;
				}

				return false;
			}
		});
		
		return construct;
	})();
	
	var BindModelDirectlyStep = (function () {
		var construct = function () { };
		
		construct.prototype = new BindPipelineStep({
			tryBind: function (view, model) {
				if (view.bindModel == undefined) {
					view.bindModel = function (newModel) {
						this._model = newModel;
					}
				}
				
				if (typeof view.bindModel == 'function') {
					view.bindModel(model);
				} 
			}
		});
		
		return construct;
	})();
	
	var AddAutoSyncronization = (function () {
		var construct = function () { };
		
		construct.prototype = new BindPipelineStep({
			tryBind: function (view, model) {
				if (view.syncronizeFromModel === undefined) {
					view.syncronizeFromModel = function () {
						_(this._modelBindings).forEach(function (binding) {
							binding.trigger();
						});
					}
				}
				
				if (view.syncronizeFromInputs === undefined) {
					view.syncronizeFromInputs = function () {
						_(this._inputBindings).chain()
							.filter(function (binding) {
								return !binding.inputType().clickable;
							})
							.forEach(function (binding) {
								binding.trigger();
							});
					}
				}
			}
		});
		
		return construct;
	})();
	
	Wire = (function () {
		var wire = function (params) {
			var view = params.view || {},
				model = params.model || {},
				bindingState = {
					boundModelProperties: [],
					boundViewElements: []
				};
				
			view.selectorFor = view.selectorFor || {};
				
			_(wire.pipeline).forEach(function (step) {
				step.tryBind(view, model, bindingState);
			});
			
			return {
				initializeFromInputs: function () {
					view.syncronizeFromInputs();
				},
				initializeFromModel: function () {
					view.syncronizeFromModel();
				}
			};			
		};
		
		wire.pipeline = [
			new PrepareBindingListsStep(),
			new BindInputsByIdToViewHandlersStep(),
			new BindInputsByNameToViewHandlersStep(),
			new BindClickablesToViewHandlersStep(),
			new BindModelPropertiesStep(),
			new BindInputsToModelStep(),
			new BindViewScopeElementToModelStep(),
			new BindModelDirectlyStep(),
			new AddAutoSyncronization()
		]
		
		return wire;
	})();
	
	return {
		Extender: Extender,
		Observable: Observable,
		Computed: Computed,
		ObservableCollection: ObservableCollection,
		SmartEvent: SmartEvent,
		View: View,
		Wire: Wire,
		BindPipelineStep: BindPipelineStep,
		Conventions: Conventions
	};
})(jQuery);
