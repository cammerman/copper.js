(function(undefined) {
	Object.extend = function (target, source, preserveExisting) {
		for (var prop in source) {
			if (source.hasOwnProperty(prop)
				&& (!preserveExisting
					|| target[prop] == undefined)) {
				target[prop] = source[prop];
			}
		}
	}

	Object.extendDeep = function (target, source, preserveExisting) {
		for (var prop in source) {
			if (!preserveExisting || target[prop] == undefined) {
				target[prop] = source[prop];
			}
		}
	}

	Observable = (function () {
		construct = function (newValue) {
			this._subscriptions = this._subscriptions || [];
			this._value = newValue || null;
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
				_(this.handlers).each(function (handler) {
					handler();
				});
			}
		};

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

	BindPipelineStep = (function () {
		var construct = function (strategy) {
			Object.extend(this, strategy);
			this._inputSelector = 'select, input[type!=button], input[type!=reset], input[type!=file]';
			this._clickableSelector = 'a, button, input[type=submit], input[type=button], input[type=reset]';
		};

		construct.prototype = {
			tryBind: function (view, model) { return false; },
			_isClickable: function ($element) {
				return $element.is(this._clickableSelector);
			},

			_isInput: function ($element) {
				return $element.is(this._inputSelector);
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
			Object.extend(this, strategy);
		};
		
		construct.prototype = new BindPipelineStep({
			_tryBindProperty: function(view, model, propertyName) {
				throw new BindPipelineStepException({
					message: 'Model property binding step is not implemented.',
					subject: model,
					member: propertyName
				});
			},
			
			tryBind: function(view, model, state) {
				var scope = this,
					propertyName;

				for (propertyName in model) {
					if (!_(state.boundModelProperties).include(propertyName)) {
						if (scope._tryBindProperty(view, model, propertyName)) {
							state.boundModelProperties.push(propertyName);
						}
					}
				}
			},
		});
		
		return construct;
	})();
	
	BindModelToHtmlStep = (function () {
		var construct = function () { };
		
		construct.prototype = new BindModelPropertyStep({
		
			_tryBindProperty: function (view, model, propertyName) {
				var property = model[propertyName],
					handler;

				if (property instanceof Observable) {
					return this._tryBindElement(property, propertyName);
				} else if (typeof property == "function") {
					handler = function (e) {
						if (e && (typeof e.preventDefault == "function")) {
							e.preventDefault();
						}

						property.call(model);
					};
					
					return this._tryBindClick(propertyName, handler);
				}
				
				return false;
			},
			
			_tryBindElement: function (property, propertyName) {
				$element = this._findViewElement(propertyName);

				if ($element) {
					if (this._tryBindInputToObservableProperty($element, property, propertyName)) {
						return true;
					} else {
						this._bindContent($element, property, propertyName);
						return true;
					}
				}

				return false;
			},
			
			_tryBindInputToObservableProperty: function ($element, property, propertyName) {
				var scope = this,
					newProperty = propertyName + '_ModelChanged',
					callback
					
				if ($element.is(this._inputSelector)) {
					callback = function (newValue) {
						$element.val(newValue);
					};
					this[newProperty] = callback;
					property.subscribe(callback);
					
					return true;
				}

				return false;
			},
			
			_bindContent: function ($element, property, propertyName) {
				var callback = function (newValue) {
					$element.html(newValue);
				};

				this[propertyName + '_ModelChanged'] = callback;

				property.subscribe(callback);
			},
			
			_tryBindClick: function (propertyName, callback) {
				$element = this._findViewElement(propertyName);

				if ($element && this._isClickable($element)) {
					this._bindClick($element, propertyName, callback);
					return true;
				}

				return false;
			},
			
			_bindClick: function ($element, propertyName, callback) {
				var handler = function () {
					callback();
				};

				this[propertyName + 'Clicked'] = handler;

				$element.click(handler);
			}
		});
		
		return construct;
	
	
	BindModelToViewHandlersStep = (function () {
		var construct = function () { };
		
		construct.prototype = new BindModelPropertyStep({
		
			_tryBindProperty: function (view, model, propertyName) {
				var property = model[propertyName],
					handler;

				if (property instanceof Observable) {
					return this._tryBindChangeEvent(property, propertyName);
				}
				
				return false;
			},
			
			_tryBindChangeEvent: function (view, property, propertyName) {
				var scope = this,
					handlerName = propertyName + '_ModelChanged';

				if (this[handlerName] != undefined) {
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
	
	BindHtmlElementStep = (function () {
		var construct = function (strategy) {
			Object.extend(this, strategy);
		};
		
		construct.prototype = new BindPipelineStep({
			_tryBindElement: function(view, model, $el) {
				var member;
				
				if ($el) {
					member = $el.attr('id');
				}
				
				throw new BindPipelineStepException({
					message: 'Model property binding step is not implemented.',
					subject: view._$documentScope,
					member: member || this._selector;
				});
			},
			
			_select: function (view) {
				if (view._$documentScope) {
					return view._$documentScope.filter(this._selector);
				} else {
					return $(this._selector);
				}
			},

			_findViewElement: function (id) {
				return this._select('#' + id);
			}
			
			tryBind: function(view, model, state) {
				var scope = this,
					propertyName;
					
				_(scope._select(view))
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
	
	BindInputsToViewHandlersStep = (function () {
		var construct = function () {
			this._selector = this._inputSelector;
		};
		
		construct.prototype = new BindHtmlElementStep({
			_tryBindElement: function (view, model, $el) {
				var scope = this,
					id = $el.attr('id'),
					newProperty = id + '_ViewChanged',
					callback;

				if (scope[newProperty] != undefined) {
					$el.change(function (e) {
						view[newProperty](e);
					});
					
					return true;
				}
				
				return false;
			}
		});
		
		return construct;
	})();
	
	BindInputsToModelStep = (function () {
		var construct = function () {
			this._selector = this._inputSelector;
		};
		
		construct.prototype = new BindHtmlElementStep({
			_tryBindElement: function (view, model, $el) {
				return scope._tryBindInputToModel($el, model);
			},
			
			_tryBindInputToModel: function ($element, model) {
				var id = $element.attr('id');
				var property = model[id];

				if (property != undefined) {
					if (property instanceof Observable) {
						this._bindOvervablePropertyToInput($element, property, id);
						return true;
					} else if (typeof property != "function") {
						this._bindSimplePropertyToInput($element, model, id);
						return true;
					}
				}

				return false;
			},
			
			_bindOvervablePropertyToInput: function ($element, property, propertyName) {
				var handlerName = propertyName + '_ViewChanged';
					callback = function (e) {
						property.val($(this).val());
					};

				this[handlerName] = callback;

				$element.change(callback);
			},

			_bindSimplePropertyToInput: function ($element, model, propertyName) {
				var handlerName = propertyName + '_ViewChanged',
					callback = function (e) {
						model[propertyName] = $(e.target).val();
					};

				this[handlerName] = callback;

				$element.change(callback);
			}
		});
		
		return construct;
	})();
	
	BindClickablesToViewHandlersStep = (function () {
		var construct = function () {
			this._selector = this._inputSelector;
		};
		
		construct.prototype = new BindHtmlElementStep({
			_tryBindElement: function (view, model, $el) {
				var scope = this,
					id = $el.attr('id'),
					handlerName = id + '_Clicked',
					callback;

				if (scope[handlerName] != undefined) {
					$el.click(function (e) {
						if (e.preventDefault != undefined) {
							e.preventDefault();
						}

						scope[handlerName](e);
					});

					return true;
				}

				return false;
			}
		});
		
		return construct;
	})();
		
	Bind = (function () {
		var pipeline = [
			new BindModelToViewHandlersStep(),
			new BindModelToHtmlStep(),
			new BindInputsToViewHandlersStep(),
			new BindInputsToModelStep(),
			new BindClickablesToViewHandlersStep()
		];
		
		return null;
	})();

	View = (function () {
		construct = function (init) {
			this._inputSelector = 'select, input[type!=button], input[type!=reset], input[type!=file]';
			this._clickableSelector = 'a, button, input[type=submit], input[type=button], input[type=reset]';

			Object.extendDeep(this, init.extend, true);
			if (init.extend
				&& init.extend._bindModel
				&& typeof init.extend._bindModel == 'function') {
				this._bindExtendedModel = init.extend._bindModel;
			}

			this._$documentScope = init.$documentScope;

			if (this._bindHtml != undefined) {
				this._bindHtml();
			}

			this._bindModel(init.model);
			this._bindClickablesToViewHandlers();
		};

		construct.prototype = {
			_bindModel: function (model) {
				var scope = this,
					propertyName,
					property,
					bound;

				for (propertyName in model) {
					scope._tryBindProperty(model, propertyName);
				}

				this._bindInputsToModelProperties(model);

				if (this._bindExtendedModel) {
					this._bindExtendedModel(model);
				}
			},

			_bindInputsToModelProperties: function (model) {
				var scope = this;
				_(scope._select(scope._inputSelector))
					.forEach(function (element) {
						var $el = $(element);

						if (scope._tryBindInputToModel($el, model)) {
							return;
						} else {
							scope._tryBindInputToViewHandler($el);
							return
						}
					});
			},

			_bindClickablesToViewHandlers: function () {
				var scope = this;
				_(scope._select(scope._clickableSelector))
					.forEach(function (element) {
						var $el = $(element);

						if (scope._isClickable($el)) {
							if (scope._tryBindClickableToViewHandler($el)) {
								return;
							}
						}
					});
			},

			_tryBindProperty: function (model, propertyName) {
				var property = model[propertyName];

				if (property instanceof Observable) {
					if (this._tryBindElement(property, propertyName)) {
						return;
					}
				} else if (typeof property == "function") {
					this._tryBindClick(propertyName, function (e) {
						if (e && (typeof e.preventDefault == "function")) {
							e.preventDefault();
						}

						property.call(model);
					});
				}
			},

			_tryBindElement: function (property, propertyName) {
				$element = this._findViewElement(propertyName);

				if ($element) {
					if (this._tryBindInputToObservableProperty($element, property, propertyName)) {
						return true;
					} else {
						this._bindContent($element, property, propertyName);
						return true;
					}
				}

				return false;
			},

			_tryBindInputToObservableProperty: function ($element, property, propertyName) {
				if ($element.is(this._inputSelector)) {
					this._bindInputToObservableProperty($element, property, propertyName);
					return true;
				}

				return false;
			},

			_bindInputToObservableProperty: function ($element, property, propertyName) {
				var scope = this,
					newProperty = propertyName + '_ModelChanged',
					callback;

				if (this[newProperty] == undefined) {
					callback = function (newValue) {
						$element.val(newValue);
					};
					this[newProperty] = callback;
					property.subscribe(callback);
				} else {
					property.subscribe(function (newValue) {
						scope[newProperty](newValue);
					});
				}
			},

			_bindOvervablePropertyToInput: function ($element, property, propertyName) {
				var callback = function (e) {
					property.val($(this).val());
				};

				this[propertyName + '_ViewChanged'] = callback;

				$element.change(callback);
			},

			_bindSimplePropertyToInput: function ($element, model, propertyName) {
				var newProperty = propertyName + '_ViewChanged',
					callback = function (e) {
						model[propertyName] = $(e.target).val();
					};

				this[newProperty] = callback;

				$element.change(callback);
			},

			_tryBindInputToModel: function ($element, model) {
				var id = $element.attr('id');
				var property = model[id];

				if (property != undefined) {
					if (property instanceof Observable) {
						this._bindOvervablePropertyToInput($element, property, id);
						return true;
					} else if (typeof property != "function") {
						this._bindSimplePropertyToInput($element, model, id);
						return true;
					}
				}

				return false;
			},

			_tryBindClickableToViewHandler: function ($element) {
				var scope = this,
					id = $element.attr('id'),
					newProperty = id + '_Clicked',
					callback;

				if (scope[newProperty] != undefined) {
					$element.click(function (e) {
						if (e.preventDefault != undefined) {
							e.preventDefault();
						}

						scope[newProperty](e);
					});

					return true;
				}

				return false;
			},

			_tryBindInputToViewHandler: function ($element) {
				var scope = this,
					id = $element.attr('id'),
					newProperty = id + '_ViewChanged',
					callback;

				if (scope[newProperty] != undefined) {
					$element.change(function (e) {
						scope[newProperty](e);
					});

					return true;
				}

				return false;
			},

			_bindContent: function ($element, property, propertyName) {
				var callback = function (newValue) {
					$element.html(newValue);
				};

				this[propertyName + '_ModelChanged'] = callback;

				property.subscribe(callback);
			},

			_tryBindClick: function (propertyName, callback) {
				$element = this._findViewElement(propertyName);

				if ($element && this._isClickable($element)) {
					this._bindClick($element, propertyName, callback);
					return true;
				}

				return false;
			},

			_isClickable: function ($element) {
				return $element.is(this._clickableSelector);
			},

			_isInput: function ($element) {
				return $element.is(this._inputSelector);
			},

			_bindClick: function ($element, propertyName, callback) {
				var handler = function () {
					callback();
				};

				this[propertyName + 'Clicked'] = handler;

				$element.click(handler);
			},

			_select: function (selector) {
				if (this._$documentScope) {
					return this._$documentScope.filter(selector);
				} else {
					return $(selector);
				}
			},

			_findViewElement: function (id) {
				return this._select('#' + id);
			}
		};

		return construct;
	})();
})();