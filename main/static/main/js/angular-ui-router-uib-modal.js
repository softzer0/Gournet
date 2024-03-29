/* global angular */
'use strict';
angular.module('ui.router.modal', ['ui.router'])
	.config(['$stateProvider', function($stateProvider) {

		var stateProviderState = $stateProvider.state;

		$stateProvider.state = function(stateName, options) {
			if (options.modal) {

				if (options.onEnter) {
					throw new Error("Invalid modal state definition: The onEnter setting may not be specified.");
				}

				if (options.onExit) {
					throw new Error("Invalid modal state definition: The onExit setting may not be specified.");
				}

				var openModal;

				// Get modal.resolve keys from state.modal or state.resolve
				var resolve = (Array.isArray(options.modal) ? options.modal : []).concat(Object.keys(options.resolve || {}));

				var inject = ['$uibModal', '$state', '$previousState'];
				options.onEnter = function($uibModal, $state, $previousState) {

					// Add resolved values to modal options
					if (resolve.length) {
						options.resolve = {};
						for(var i = 0; i < resolve.length; i++) {
							options.resolve[resolve[i]] = injectedConstant(arguments[inject.length + i]);
						}
					}

					var prev = $previousState.get();
					if (prev !== null && prev.state.name.indexOf('showObjs') == -1) $previousState.memo('main');
					var thisModal = openModal = $uibModal.open(options);

					openModal.result['finally'](function() {
						if (thisModal === openModal) {
							// Dialog was closed via $uibModalInstance.close/dismiss, go to our previous/parent state
							if ($previousState.get('main') != null) {
								$previousState.go('main');
								$previousState.forget('main');
							} else $state.go($state.get('^', stateName).name || 'main.main');
						}
					});
				};

				// Make sure that onEnter receives state.resolve configuration
				options.onEnter.$inject = inject.concat(resolve);

				options.onExit = function() {
					if (openModal) {
						// State has changed while dialog was open
						openModal.close();
						openModal = null;
					}
				};

			}

			return stateProviderState.call($stateProvider, stateName, options);
		};
	}]);

function injectedConstant(val) {
	return [function() { return val; }];
}