sap.ui.define(
	[
		"sap/ui/core/message/Message",
		"sap/ui/core/MessageType",
		"sap/ui/core/ValueState"
	],
	function (Message, MessageType, ValueState) {
		"use strict";

		/**
		 * @name        nl.qualiture.plunk.demo.utils.Validator
		 *
		 * @class
		 * @classdesc   Validator class.<br/>
		 *
		 * @version     Oktober 2015
		 * @author      Robin van het Hof
		 */
		var Validator = function () {
			this._isValid = true;
			this._isValidationPerformed = false;
			this._aPossibleAggregations = [
				"items",
				"content",
				"form",
				"formContainers",
				"formElements",
				"fields",
				"sections",
				"subSections",
				"_grid",
				"cells",
				"_page",
                "headerContainer",
                "tokens",
                "suggestionItems"
                // ObjectHeader has headerContainer aggregation
			];
			this._aValidateProperties = ["value", "selectedKey", "text", "dateValue"]; // yes, I want to validate Select and Text controls too

			// Get Message Manager instance
			this._oMessageManager = sap.ui.getCore().getMessageManager();
			// Get Message Model
			this._oMessageModel = this._oMessageManager.getMessageModel();
		};

		/**
		 * Returns true _only_ when the form validation has been performed, and no validation errors were found
		 * 
		 *
		 * @returns {boolean} Validation result
		 */
		Validator.prototype.isValid = function () {
			return this._isValidationPerformed && this._isValid;
		};

		/**
		 * Recursively validates the given oControl and any aggregations (i.e. child controls) it may have
		 * 
		 *
		 * @param {(sap.ui.core.Control|sap.ui.layout.form.FormContainer|sap.ui.layout.form.FormElement)} oControl - The control or element to be validated.
		 * @return {boolean} Whether the oControl is valid or not.
		 */
		Validator.prototype.validate = function (oControl) {
			this._isValid = true;
			// Clear added messages
			this._removeMessages();

			this._validate(oControl);
			
			// Update message model bindings to avoid old messages cachig and output
			this._oMessageModel.updateBindings();

			return this.isValid();
		};

		/**
		 * Clear the value state of all the controls
		 * 
		 *
		 * @param {(sap.ui.core.Control|sap.ui.layout.form.FormContainer|sap.ui.layout.form.FormElement)} oControl - The control or element to be validated.
		 */
		Validator.prototype.clearValueState = function (oControl) {
			if (!oControl) {
				return;
			}
			if (oControl.setValueState) {
				oControl.setValueState(ValueState.None);
				oControl.setValueStateText(); // Clear state text to avoid caching of previous value
			}

			this._recursiveCall(oControl, this.clearValueState);
		};

		/**
		 * Recursively validates the given oControl and any aggregations (i.e. child controls) it may have
		 * 
		 *
		 * @param {(sap.ui.core.Control|sap.ui.layout.form.FormContainer|sap.ui.layout.form.FormElement)} oControl - The control or element to be validated.
		 */
		Validator.prototype._validate = function (oControl) {
			var i,
				isValidatedControl = true,
				isValid = true;

			// only validate controls and elements which have a 'visible' property
			// and are visible controls (invisible controls make no sense checking)
			if (!(
					(oControl instanceof sap.ui.core.Control ||
						oControl instanceof sap.ui.layout.form.FormContainer ||
						oControl instanceof sap.ui.layout.form.FormElement ||
						oControl instanceof sap.m.IconTabFilter) &&
					oControl.getVisible()
				)) {
				return;
			}

			if (
				oControl.getRequired && oControl.getRequired() === true &&
				oControl.getEnabled && oControl.getEnabled() === true
			) {
				// Control required
                isValid = this._validateRequired(oControl);
                
				// Perform constraint validation after required validation
				if (isValid && (i = this._hasType(oControl)) !== -1 && oControl.getEnabled &&
					oControl.getEnabled() === true) {
					// Control constraints
					isValid = this._validateConstraint(oControl, i);
				}

			} else if (
				(i = this._hasType(oControl)) !== -1 && oControl.getEnabled &&
				oControl.getEnabled() === true
			) {
				// Control constraints
				isValid = this._validateConstraint(oControl, i);
			} 
			else if (
				oControl.getValueState &&
				oControl.getValueState() === ValueState.Error
			) {
				// Control custom validation
				isValid = false;
				this._setValueState(oControl, ValueState.Error, "Wrong input");
			}
			else {
				isValidatedControl = false;
			}

			if (!isValid) {
				this._isValid = false;
				this._addMessage(oControl);
			}

			// if the control could not be validated, it may have aggregations
			if (!isValidatedControl) {
				this._recursiveCall(oControl, this._validate);
			}
			this._isValidationPerformed = true;
		};

		/**
		 * Check if the control is required
		 * 
		 *
		 * @param {(sap.ui.core.Control|sap.ui.layout.form.FormContainer|sap.ui.layout.form.FormElement)} oControl - The control or element to be validated.
		 * @return {bool} this._isValid - If the property is valid
		 */
		Validator.prototype._validateRequired = function (oControl) {
			// check control for any properties worth validating
            var isValid = true;
            
            if(oControl.getMetadata().getName() === "sap.m.MultiInput"){                
                if(oControl.getTokens().length === 1){
                    return true;
                }
                
                this._setValueState(
                    oControl,
                    ValueState.Error,
                    (oControl.getPlaceholder() ? oControl.getPlaceholder() : "Error")
                );
                return false
            }

			for (var i = 0; i < this._aValidateProperties.length; i += 1) {
				try {
                    oControl.getBinding(this._aValidateProperties[i]);
					var oExternalValue = oControl.getProperty(
						this._aValidateProperties[i]
					);

					if (oControl.getBinding("items") &&
						oControl.getProperty("selectedKey").length === 0) {
						// might be a select
						this._setValueState(
							oControl,
							ValueState.Error,
							(oControl.getPlaceholder() ? oControl.getPlaceholder() : "Error")
						);
						isValid = false;
					}
					else if (!oExternalValue || oExternalValue === "") {
						this._setValueState(
							oControl,
							ValueState.Error,
							(oControl.getPlaceholder() ? oControl.getPlaceholder() : "Error")
						);
						isValid = false;
					}
					else {
						oControl.setValueState(ValueState.None);
						isValid = true;
						break;
					}
				} catch (ex) {
                    // Validation failed                   
				}
			}
			return isValid;
		};

		/**
		 * Check if the control is required
		 * 
		 *
		 * @param {(sap.ui.core.Control|sap.ui.layout.form.FormContainer|sap.ui.layout.form.FormElement)} oControl - The control or element to be validated.
		 * @param {int} i - The index of the property
		 * @return {bool} this._isValid - If the property is valid
		 */
		Validator.prototype._validateConstraint = function (oControl, i) {
			var isValid = true;

			try {
				var editable = oControl.getProperty("editable");
			} catch (ex) {
				editable = true;
			}

			if (editable) {
				try {
					// try validating the bound value
					var oControlBinding = oControl.getBinding(
						this._aValidateProperties[i]
					);
					var oExternalValue = oControl.getProperty(
						this._aValidateProperties[i]
					);
					var oInternalValue = oControlBinding
						.getType()
						.parseValue(oExternalValue, oControlBinding.sInternalType);

					oControlBinding.getType().validateValue(oInternalValue);

					oControl.setValueState(ValueState.None);
					oControl.setValueStateText(); // Clear state text to avoid caching of previous value
				} catch (ex) {
					oControl.setValueStateText(); // Clear state text to avoid caching of previous value

					// catch any validation errors
					isValid = false;
					this._setValueState(oControl, ValueState.Error, ex.message);
				}
			}
			return isValid;
		};

		/**
		 * Add message to the MessageManager
		 * 
		 *
		 * @param {(sap.ui.core.Control|sap.ui.layout.form.FormContainer|sap.ui.layout.form.FormElement)} oControl - The control or element to be validated.
		 * @param {string} sMessage - Customize the message
		 */
		Validator.prototype._addMessage = function (oControl, sMessage) {
			var sLabel, oLabel,
				eMessageType = MessageType.Error;

			if (sMessage === undefined) {
				sMessage = "Wrong input"; // Default message
			}

			switch (oControl.getMetadata().getName()) {
				case "sap.m.CheckBox":
				case "sap.m.Input":
                case "sap.m.MultiInput":
				case "sap.m.Select":
				case "sap.m.ComboBox":
				case "sap.m.TextArea":
				case "sap.m.DatePicker":
				case "sap.m.TimePicker":
				case "sap.m.DateTimePicker":
				case "sap.m.StepInput":
					oLabel = (oControl.getParent().getLabel) ? oControl.getParent().getLabel() : null;
					if (oLabel) {
						// Get label text from parent control
						sLabel = oLabel.getText();
					} else {
						// Get label text from custom property for controls with no label provided
						sLabel = oControl.data("label");
					}
					break;
			}

			if (oControl.getValueState) {
				eMessageType = this._convertValueStateToMessageType(
					oControl.getValueState()
				);
			}

			// Get message target
			var sTarget = "";
			if (oControl.getBindingPath("value")) {
				sTarget = oControl.getId() + "/value";
			}
			if (oControl.getBindingPath("selectedKey")) {
				sTarget = oControl.getId() + "/selectedKey";
			}

			var sNewMessage = oControl.getValueStateText ? oControl.getValueStateText() : sMessage;

			if (!this._updateControlMessage(sTarget, sNewMessage)) {
				this._oMessageManager.addMessages(
					new Message({
						message: sNewMessage, // Get Message from ValueStateText if available
						type: eMessageType,
						target: sTarget,
						additionalText: sLabel // Get label from the form element
					})
				);
			}
		};

		/**
		 * Check if the control property has a data type, then returns the index of the property to validate
		 * 
		 *
		 * @param {(sap.ui.core.Control|sap.ui.layout.form.FormContainer|sap.ui.layout.form.FormElement)} oControl - The control or element to be validated.
		 * @return {int} i - The index of the property to validate
		 */
		Validator.prototype._hasType = function (oControl) {
            // check if a data type exists (which may have validation constraints)
            try{
                for (var i = 0; i < this._aValidateProperties.length; i += 1) {
                    if (
                        oControl.getBinding(this._aValidateProperties[i]) &&
                        oControl.getBinding(this._aValidateProperties[i]).getType()
                    ) {
                        return i;
                    }
                }
                return -1;
            }catch(ex){
                
                return -1;
            }
		};

		/**
		 * Set ValueState and ValueStateText of the control
		 * 
		 *
		 * @param {sap.ui.core.Control} oControl - The control for which value state to be set
		 * @param {sap.ui.core.ValueState} eValueState - The ValueState to be set
		 * @param {string} sText - The ValueStateText to be set
		 */
		Validator.prototype._setValueState = function (oControl, eValueState, sText) {
			oControl.setValueState(eValueState);
			if (oControl.getValueStateText) {
				oControl.setValueStateText(sText);
			}
		};

		/**
		 * Recursively calls the function on all the children of the aggregation
		 * 
		 *
		 * @param {(sap.ui.core.Control|sap.ui.layout.form.FormContainer|sap.ui.layout.form.FormElement)} oControl - The control or element to be validated.
		 * @param {function} fFunction - The function to call recursively
		 */
		Validator.prototype._recursiveCall = function (oControl, fFunction) {
			for (var i = 0; i < this._aPossibleAggregations.length; i += 1) {
				var aControlAggregation = oControl.getAggregation(
					this._aPossibleAggregations[i]
				);

				if (!aControlAggregation) {
					continue;
				}

				if (aControlAggregation instanceof Array) {
					// generally, aggregations are of type Array
					for (var j = 0; j < aControlAggregation.length; j += 1) {
						fFunction.call(this, aControlAggregation[j]);
					}
				} else {
					// ...however, with sap.ui.layout.form.Form, it is a single object *sigh*
					fFunction.call(this, aControlAggregation);
				}
			}
		};

		/**
		 * Converts value state of the control to message type
		 * 
		 *
		 * @param {sap.ui.core.ValueState} eValueState - Value State of the control
		 * @return {sap.ui.core.MessageType} eMessageType - Message Type
		 */
		Validator.prototype._convertValueStateToMessageType = function (eValueState) {
			var eMessageType;

			switch (eValueState) {
				case ValueState.Error:
					eMessageType = MessageType.Error;
					break;
				case ValueState.Information:
					eMessageType = MessageType.Information;
					break;
				case ValueState.None:
					eMessageType = MessageType.None;
					break;
				case ValueState.Success:
					eMessageType = MessageType.Success;
					break;
				case ValueState.Warning:
					eMessageType = MessageType.Warning;
					break;
				default:
					eMessageType = MessageType.Error;
			}
			return eMessageType;
		};

		/** 
		 * Clear manually added validation messages
		 * 
		 */
		Validator.prototype._removeMessages = function () {
			this._oMessageModel.getData().forEach(function (oMessage) {
				if (!oMessage.validation) {
					this._oMessageManager.removeMessages(oMessage);
				}
			}.bind(this));
		};

		/** 
		 * Update automatically generated control validation message text by message target 
		 * 
		 * 
		 * @param {string} sTarget - Message target ("controlId/property")
		 * @param {string} sMessage - Message text
		 * @return {boolean} bUpdated - Whether message updated or not
		 */
		Validator.prototype._updateControlMessage = function (sTarget, sMessage) {
			var bUpdated = false;
			this._oMessageModel.getData().forEach(function (oMessage) {
				if (oMessage.target === sTarget && oMessage.validation) {
					oMessage.setMessage(sMessage);
					bUpdated = true;
				}
			});
			return bUpdated;
		};

		return Validator;
	}
);