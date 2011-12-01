solder = (function($, undefined) {
	var Observable,
		SmartEvent,
		View,
		BindPipelineStep,
		BindPipeline,
		Extender;
		
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
		}
	};

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
			Extender.extend(this, strategy);
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
			
			_select: function (view, selector) {
				if (view.$documentScope) {
					return view.$documentScope.filter(selector);
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
					return this._tryBindElement(view, property, propertyName);
				} else if (typeof property == "function") {
					handler = function (e) {
						if (e && (typeof e.preventDefault == "function")) {
							e.preventDefault();
						}

						property.call(model);
					};
					
					return this._tryBindClick(view, propertyName, handler);
				}
				
				return false;
			},
			
			_tryBindElement: function (view, property, propertyName) {
				$element = this._findViewElement(view, propertyName);

				if ($element) {
					if (this._tryBindInputToObservableProperty(view, $element, property, propertyName)) {
						return true;
					} else {
						this._bindContent(view, $element, property, propertyName);
						return true;
					}
				}

				return false;
			},
			
			_tryBindInputToObservableProperty: function (view, $element, property, propertyName) {
				var scope = this,
					newProperty = propertyName + '_ModelChanged',
					callback
					
				if ($element.is(this._inputSelector)) {
					callback = function (newValue) {
						$element.val(newValue);
					};
					view[newProperty] = callback;
					property.subscribe(callback);
					
					return true;
				}

				return false;
			},
			
			_bindContent: function (view, $element, property, propertyName) {
				var callback = function (newValue) {
					$element.html(newValue);
				};

				view[propertyName + '_ModelChanged'] = callback;

				property.subscribe(callback);
			},
			
			_tryBindClick: function (view, propertyName, callback) {
				$element = this._findViewElement(view, propertyName);

				if ($element && this._isClickable($element)) {
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
	
	BindModelToViewHandlersStep = (function () {
		var construct = function () { };
		
		construct.prototype = new BindModelPropertyStep({
		
			_tryBindProperty: function (view, model, propertyName) {
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
					message: 'Model property binding step is not implemented.',
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
	
	BindInputsToViewHandlersStep = (function () {
		var construct = function () {
			this._selector = this._inputSelector;
		};
		
		construct.prototype = new BindHtmlElementStep({
			_tryBindElement: function (view, model, $el) {
				var id = $el.attr('id'),
					newProperty = id + '_ViewChanged',
					callback;

				if (id != undefined && view[newProperty] != undefined) {
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
				return this._tryBindInputToModel(view, $el, model);
			},
			
			_tryBindInputToModel: function (view, $element, model) {
				var id = $element.attr('id');
				var property = model[id];

				if (id != undefined && property != undefined) {
					if (property instanceof Observable) {
						this._bindOvervablePropertyToInput(view, $element, property, id);
						return true;
					} else if (typeof property != "function") {
						this._bindSimplePropertyToInput(view, $element, model, id);
						return true;
					}
				}

				return false;
			},
			
			_bindOvervablePropertyToInput: function (view, $element, property, propertyName) {
				var handlerName = propertyName + '_ViewChanged';
					callback = function (e) {
						property.val($(this).val());
					};

				view[handlerName] = callback;

				$element.change(callback);
			},

			_bindSimplePropertyToInput: function (view, $element, model, propertyName) {
				var handlerName = propertyName + '_ViewChanged',
					callback = function (e) {
						model[propertyName] = $(e.target).val();
					};

				view[handlerName] = callback;

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
				
			_(bind.pipeline).forEach(function (step) {
				step.tryBind(view, model, bindingState);
			});
		};
		
		bind.pipeline = [
			new BindModelToViewHandlersStep(),
			new BindModelToHtmlStep(),
			new BindInputsToViewHandlersStep(),
			new BindInputsToModelStep(),
			new BindClickablesToViewHandlersStep(),
			new BindModelDirectlyStep()
		]
		
		return bind;
	})();
	
	return {
		Extender: Extender,
		Observable: Observable,
		SmartEvent: SmartEvent,
		View: View,
		Bind: Bind,
		BindPipelineStep: BindPipelineStep
	};
})(jQuery);