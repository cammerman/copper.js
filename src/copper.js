/*
    copper.js
    Author: Chris Ammerman
    License: New BSD License (http://www.opensource.org/licenses/bsd-license.php)
    Version 0.2.0
*/
copper  = (function($, undefined) {
	var Observable,
		ObservableCollection,
		EventHost,
		SmartEvent,
		View,
		BindPipelineStep,
		BindPipeline,
		ModelPropertyBindPipeline,
		Extender,
		Conventions;
		
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
		var construct;

		construct = function (name) {
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
		construct = function (eventNames) {
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
		construct = function (newValue) {
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
			}
		};

		return construct;
	})();

	ObservableCollection = (function () {
		construct = function (initialValue) {
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

	CachedSelect = (function () {
		var construct = function ($scope) {
			this._$scope = $scope;
		};

		construct.prototype = {
			select: function (selector) {
				var cached = this._cache[selector];

				if (cached !== undefined) {
					return cached;
				}

				if (this._$scope === undefined) {
					return $(selector);
				} else {
					return this._$scope.find(selector);
				}
			}
		};

		return construct;
	})();
	
	Conventions = {
		inputSelector: 'select, input[type!=button][type!=reset][type!=file][type!=checkbox][type!=radio]',
		checkableSelector: 'input[type=checkbox], input[type=radio]',
		clickableSelector: 'a, button, input[type=submit], input[type=button], input[type=reset]'
	};

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
			},

			_select: function (view, selector) {
				if (view.$documentScope) {
					return view.$documentScope.find(selector);
				} else {
					return $(selector);
				}
			},

			_findViewElement: function (view, id) {
				return this._select(view, '#' + id);
			},
		};

		return construct;
	})();
	
	BindPipelineStepException = (function () {
		var construct = function (init) {
			this.message = init.message;
			this.subject = init.subject;
			this.member = init.member;
		}
		
		return construct;
	})();
	
	BindModelPropertyStep = (function () {
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
	
	BindModelObservablePropertyToViewHandler = (function () {
		var construct = function () { };
		
		construct.prototype = new BindModelPropertyStep({
		
			tryBindProperty: function (view, model, propertyName) {
				var property = model[propertyName],
					handler;

				if (property instanceof Observable) {
					return this._tryBindChangeEvent(view, property, propertyName);
				}
				
				return false;
			},
			
			_tryBindChangeEvent: function (view, property, propertyName) {
				var scope = this,
					handlerName = propertyName + '_ModelChanged';

				if (view[handlerName] != undefined) {
					property.subscribe(function (newValue) {
						view[handlerName](newValue);
					});
					
					return true;
				}
				
				return false;
			}
		});
		
		return construct;
	})();
	
	BindModelObservablePropertyToInput = (function () {
		var construct = function (strategy) {
			Extender.extend(this, strategy);
		};
		
		construct.prototype = new BindModelPropertyStep({
		
			tryBindProperty: function (view, model, propertyName) {
				var property = model[propertyName],
					handler;

				if (property instanceof Observable) {
					return this._tryBindElement(view, property, propertyName);
				}
				
				return false;
			},
			
			_findBindableElement: function (view, propertyName) {
				throw new BindPipelineStepException({
					message: 'Element selector is not implemented.',
					subject: view.$documentScope,
					member: member || this._selector
				});
			},
			
			_tryBindElement: function (view, property, propertyName) {
				$element = this._findBindableElement(view, propertyName);

				if ($element && $element.length > 0) {
					if (this._tryBindInputToObservableProperty(view, $element, property, propertyName)) {
						return true;
					}
				}

				return false;
			},
			
			_tryBindInputToObservableProperty: function (view, $element, property, propertyName) {
				var scope = this,
					newProperty = propertyName + '_ModelChanged',
					callback;
					
				if (scope._isInput($element)) {
					callback = function (newValue) {
						$element.val(newValue);
					};
				} else if (scope._isCheckable($element)) {
					callback = function (newValue) {
						$element.attr('checked', (newValue ? 'checked' : ''));
					};
				}

				if (callback != undefined) {
					view[newProperty] = callback;
					property.subscribe(callback);
					return true;
				}

				return false;
			}
		});
		
		return construct;
	})();
	
	BindModelObservablePropertyToInputBySelector = (function () {
		var construct = function () { };
		
		construct.prototype = new BindModelObservablePropertyToInput({
		
			_findBindableElement: function (view, propertyName) {
				var selector = view.selectorFor[propertyName];
				return (selector == undefined) ? undefined : this._select(view, selector);
			}
		});
		
		return construct;
	})();
	
	BindModelObservablePropertyToInputById = (function () {
		var construct = function () { };
		
		construct.prototype = new BindModelObservablePropertyToInput({
		
			_findBindableElement: function (view, propertyName) {
				return this._findViewElement(view, propertyName);
			}
		});
		
		return construct;
	})();
	
	BindModelObservablePropertyToInputByName = (function () {
		var construct = function () { };
		
		construct.prototype = new BindModelObservablePropertyToInput({
		
			_findBindableElement: function (view, propertyName) {
				return this._select(view, 'input[name="' + propertyName + '"]');
			}
		});
		
		return construct;
	})();
	
	BindModelObservablePropertyToContent = (function () {
		var construct = function (strategy) {
			Extender.extend(this, strategy);
		};
		
		construct.prototype = new BindModelPropertyStep({
		
			_findBindableElement: function (view, propertyName) {
				throw new BindPipelineStepException({
					message: 'Element selector is not implemented.',
					subject: view.$documentScope,
					member: member || this._selector
				});
			},
			
			tryBindProperty: function (view, model, propertyName) {
				var property = model[propertyName],
					handler;

				if (property instanceof Observable) {
					return this._tryBindElement(view, property, propertyName);
				}
				
				return false;
			},
			
			_tryBindElement: function (view, property, propertyName) {
				$element = this._findBindableElement(view, propertyName);

				if ($element && $element.length > 0) {
					if (!this._isInput($element) && !this._isCheckable($element)) {
						return this._bindContent(view, $element, property, propertyName);
					}
				}

				return false;
			},
						
			_bindContent: function (view, $element, property, propertyName) {
				var callback = function (newValue) {
					$element.html(newValue);
				};

				view[propertyName + '_ModelChanged'] = callback;

				property.subscribe(callback);
			}
		});
		
		return construct;
	})();
	
	BindModelObservablePropertyToContentById = (function () {
		var construct = function () { };
		
		construct.prototype = new BindModelObservablePropertyToContent({
			_findBindableElement: function (view, propertyName) {
				return this._findViewElement(view, propertyName);
			}
		});
		
		return construct;
	})();
	
	BindModelObservablePropertyToContentBySelector = (function () {
		var construct = function () { };
		
		construct.prototype = new BindModelObservablePropertyToContent({
			_findBindableElement: function (view, propertyName) {
				var selector = view.selectorFor[propertyName];
				return (selector == undefined) ? undefined : this._select(view, selector);
			}
		});
		
		return construct;
	})();
	
	BindModelObservablePropertyToInputScope = (function () {
		var construct = function () { };
		
		construct.prototype = new BindModelPropertyStep({
		
			tryBindProperty: function (view, model, propertyName) {
				var property = model[propertyName],
					handler;

				if (property instanceof Observable) {
					return this._tryBindScopeElement(view, property, propertyName);
				}
				
				return false;
			},
			
			_tryBindScopeElement: function (view, property, propertyName) {
				$element = view.$documentScope;

				if (propertyName == 'Value' && $element) {
					if (this._tryBindInputToObservableProperty(view, $element, property, propertyName)) {
						return true;
					}
				}

				return false;
			},
			
			_tryBindInputToObservableProperty: function (view, $element, property, propertyName) {
				var scope = this,
					newProperty = propertyName + '_ModelChanged',
					callback;
					
				if (scope._isInput($element)) {
					callback = function (newValue) {
						$element.val(newValue);
					};
				} else if (scope._isCheckable($element)) {
					callback = function (newValue) {
						$element.attr('checked', (newValue ? 'checked' : ''));
					};
				}

				if (callback) {
					view[newProperty] = callback;
					property.subscribe(callback);
					
					return true;
				}

				return false;
			}
		});
		
		return construct;
	})();
	
	BindModelObservablePropertyToInputContent = (function () {
		var construct = function () { };
		
		construct.prototype = new BindModelPropertyStep({
		
			tryBindProperty: function (view, model, propertyName) {
				var property = model[propertyName],
					handler;

				if (property instanceof Observable) {
					return this._tryBindScopeElement(view, property, propertyName);
				}
				
				return false;
			},
			
			_tryBindScopeElement: function (view, property, propertyName) {
				$element = view.$documentScope;

				if (propertyName == 'Value' && $element) {
					if (this._isInput($element)) {
						return this._bindContent(view, $element, property, propertyName);
					}
				}

				return false;
			},
			
			_bindContent: function (view, $element, property, propertyName) {
				var callback = function (newValue) {
					$element.html(newValue);
				};

				view[propertyName + '_ModelChanged'] = callback;

				property.subscribe(callback);
			}
		});
		
		return construct;
	})();
	
	BindModelFunctionPropertyToClickable = (function () {
		var construct = function (strategy) {
			Extender.extend(this, strategy);
		};
		
		construct.prototype = new BindModelPropertyStep({
		
			_findBindableElement: function (view, propertyName) {
				throw new BindPipelineStepException({
					message: 'Element selector is not implemented.',
					subject: view.$documentScope,
					member: member || this._selector
				});
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
				var handler = function (e) {
					callback(e);
				};

				view[propertyName + '_Clicked'] = handler;

				$element.click(handler);
			}
		});
		
		return construct;
	})();
	
	BindModelFunctionPropertyToClickableBySelector = (function () {
		var construct = function () { };
		
		construct.prototype = new BindModelFunctionPropertyToClickable({
			_findBindableElement: function (view, propertyName) {
				var selector = view.selectorFor[propertyName];
				return (selector == undefined) ? undefined : this._select(view, selector);
			}
		});
		
		return construct;
	})();
	
	BindModelFunctionPropertyToClickableById = (function () {
		var construct = function () { };
		
		construct.prototype = new BindModelFunctionPropertyToClickable({
			_findBindableElement: function (view, propertyName) {
				return this._findViewElement(view, propertyName);
			}
		});
		
		return construct;
	})();
	
	BindModelFunctionPropertyToClickableScope = (function () {
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
				var handler = function (e) {
					callback(e);
				};

				view['Clicked'] = handler;

				$element.click(handler);
			}
		});
		
		return construct;
	})();
	
	ModelPropertyBindPipeline = [
		new BindModelObservablePropertyToViewHandler(),
		new BindModelObservablePropertyToInputBySelector(),
		new BindModelObservablePropertyToInputById(),
		new BindModelObservablePropertyToInputByName(),
		new BindModelObservablePropertyToContentBySelector(),
		new BindModelObservablePropertyToContentById(),
		new BindModelObservablePropertyToInputScope(),
		new BindModelObservablePropertyToInputContent(),
		new BindModelFunctionPropertyToClickableBySelector(),
		new BindModelFunctionPropertyToClickableById(),
		new BindModelFunctionPropertyToClickableScope()
	];
	
	BindHtmlElementStep = (function () {
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
				
				_(scope._select(view, scope._selector))
					.forEach(function (element) {
						var $el = $(element);
						
						if (!_(state.boundViewProperties).include($el)) {
							if (scope._tryBindElement(view, model, $el)) {
								state.boundViewElements.push($el);
							}
						}
					});
			},
		});
		
		return construct;
	})();
	
	BindModelPropertiesStep = (function () {
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
			},
		});
		
		return construct;
	})();
	
	BindInputsByIdToViewHandlersStep = (function () {
		var construct = function () {
			this._selector = [Conventions.inputSelector, Conventions.checkableSelector].join(',');
		};
		
		construct.prototype = new BindHtmlElementStep({
			_tryBindElement: function (view, model, $el) {
				var id = $el.attr('id'),
					newProperty = id + '_ViewChanged',
					callback;

				if (id != undefined && view[newProperty] != undefined) {
					if (this._isInput($el)) {
						$el.change(function (e) {
							view[newProperty](e);
						});

						return true;
					} else if (this._isCheckable($el)) {
						$el.click(function (e) {
							view[newProperty]($(this).is(':checked'));
						});

						return true;
					}
				}
				
				return false;
			}
		});
		
		return construct;
	})();
	
	BindInputsByNameToViewHandlersStep = (function () {
		var construct = function () {
			this._selector = [Conventions.inputSelector, Conventions.checkableSelector].join(',');
		};
		
		construct.prototype = new BindHtmlElementStep({
			_tryBindElement: function (view, model, $el) {
				var id = $el.attr('name'),
					newProperty = id + '_ViewChanged',
					callback;

				if (id != undefined && view[newProperty] != undefined) {
					if (this._isInput($el)) {
						$el.change(function (e) {
							view[newProperty](e);
						});

						return true;
					} else if (this._isCheckable($el)) {
						$el.click(function (e) {
							view[newProperty]($(this).is(':checked'));
						});

						return true;
					}
					
					return true;
				}
				
				return false;
			}
		});
		
		return construct;
	})();
	
	BindViewScopeElementToModelStep = (function () {
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
			
			_bindOvervablePropertyToInput: function (view, $scopeElement, property) {
				var handlerName = 'Value_ViewChanged',
					callback;
					
				if (this._isInput($element)) {
					callback = function (e) {
						property.val($(this).val());
					};

					view[handlerName] = callback;		
					$element.change(callback);
				} else if (this._isCheckable($element)) {
					callback = function (e) {
						property.val($(this).is(':checked'));
					};

					view[handlerName] = callback;
					$element.click(callback);
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
					$element.change(callback);
				} else if (this._isCheckable($element)) {
					callback = function (e) {
						model['Value'] = $(e.target).is(':checked');
					};

					view[handlerName] = callback;
					$element.click(callback);
				}
			}
		});
		
		return construct;
	})();
	
	BindInputsToModelStep = (function () {
		var construct = function (strategy) {
			Extender.extend(this, strategy);
			this._selector = [Conventions.inputSelector, Conventions.checkableSelector].join(',');
		};
		
		construct.prototype = new BindHtmlElementStep({
			_tryBindElement: function (view, model, $el) {
				return this._tryBindInputToModel(view, $el, model);
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

			_bindOvervablePropertyToInput: function (view, $element, property, propertyName) {
				var handlerName = propertyName + '_ViewChanged',
					callback;
					
				if (this._isInput($element)) {
					callback = function (e) {
						property.val($(this).val());
					};

					view[handlerName] = callback;		
					$element.change(callback);
				} else if (this._isCheckable($element)) {
					callback = function (e) {
						property.val($(this).is(':checked'));
					};

					view[handlerName] = callback;
					$element.click(callback);
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
					$element.change(callback);
				} else if (this._isCheckable($element)) {
					callback = function (e) {
						model[propertyName] = $(e.target).is(':checked');
					};

					view[handlerName] = callback;
					$element.click(callback);
				}
			}
		});
		
		return construct;
	})();
	
	BindInputsToModelBySelectorStep = (function () {
		var construct = function () {
		};
		
		construct.prototype = new BindInputsToModelStep({
			_propertyName: function ($element, view) {
				var selectorFor = view.selectorFor,
					property;
				
				for (property in view.selectorFor) {
					if ($element.is(selectorFor[property])) {
						return property;
					}
					
					return undefined;
				}
			}
		});
		
		return construct;
	})();
	
	BindInputsToModelByIdStep = (function () {
		var construct = function () {
		};
		
		construct.prototype = new BindInputsToModelStep({
			_propertyName: function ($element, view) {
				return $element.attr('id');
			}
		});
		
		return construct;
	})();
	
	BindInputsToModelByNameStep = (function () {
		var construct = function () {
		};
		
		construct.prototype = new BindInputsToModelStep({
			_propertyName: function ($element, view) {
				return $element.attr('name');
			}
		});
		
		return construct;
	})();
	
	BindClickablesToViewHandlersStep = (function () {
		var construct = function () {
			this._selector = Conventions.clickableSelector;
		};
		
		construct.prototype = new BindHtmlElementStep({
			_tryBindElement: function (view, model, $el) {
				var id = $el.attr('id'),
					handlerName = id + '_Clicked',
					callback;

				if (id != undefined && view[handlerName] != undefined) {
					$el.click(function (e) {
						if (e.preventDefault != undefined) {
							e.preventDefault();
						}

						view[handlerName](e);
					});

					return true;
				}

				return false;
			}
		});
		
		return construct;
	})();
	
	BindModelDirectlyStep = (function () {
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
	
	Bind = (function () {
		var bind = function (params) {
			var view = params.view || {},
				model = params.model || {},
				bindingState = {
					boundModelProperties: [],
					boundViewElements: []
				};
				
			view.selectorFor = view.selectorFor || {};
				
			_(bind.pipeline).forEach(function (step) {
				step.tryBind(view, model, bindingState);
			});
		};
		
		bind.pipeline = [
			new BindInputsByIdToViewHandlersStep(),
			new BindInputsByNameToViewHandlersStep(),
			new BindClickablesToViewHandlersStep(),
			new BindModelPropertiesStep(),
			new BindInputsToModelBySelectorStep(),
			new BindInputsToModelByIdStep(),
			new BindInputsToModelByNameStep(),
			new BindViewScopeElementToModelStep(),
			new BindModelDirectlyStep()
		]
		
		return bind;
	})();
	
	return {
		Extender: Extender,
		Observable: Observable,
		ObservableCollection: ObservableCollection,
		SmartEvent: SmartEvent,
		View: View,
		Bind: Bind,
		BindPipelineStep: BindPipelineStep,
		Conventions: Conventions
	};
})(jQuery);