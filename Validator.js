/*global sap */

sap.ui.define([
    "sap/ui/core/message/Message",
    "sap/ui/core/MessageType",
    "sap/ui/core/ValueState"
], function (Message, MessageType, ValueState) {
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
    };

    /**
     * Returns true _only_ when the form validation has been performed, and no validation errors were found
     * @memberof nl.qualiture.plunk.demo.utils.Validator
     *
     * @returns {boolean}
     */
    Validator.prototype.isValid = function () {
        return this._isValidationPerformed && this._isValid;
    };

    /**
     * Recursively validates the given oControl and any aggregations (i.e. child controls) it may have
     * @memberof nl.qualiture.plunk.demo.utils.Validator
     *
     * @param {(sap.ui.core.Control|sap.ui.layout.form.FormContainer|sap.ui.layout.form.FormElement)} oControl - The control or element to be validated.
     * @return {boolean} whether the oControl is valid or not.
     */
    Validator.prototype.validate = function (oControl) {
        this._isValid = true;
        sap.ui.getCore().getMessageManager().removeAllMessages();
        this._validate(oControl);
        return this.isValid();
    };

    /**
     * Recursively validates the given oControl and any aggregations (i.e. child controls) it may have
     * @memberof nl.qualiture.plunk.demo.utils.Validator
     *
     * @param {(sap.ui.core.Control|sap.ui.layout.form.FormContainer|sap.ui.layout.form.FormElement)} oControl - The control or element to be validated.
     */
    Validator.prototype._validate = function (oControl) {
        var aPossibleAggregations = ["items", "content", "form", "formContainers", "formElements", "fields", "sections", "subSections", "_grid", "cells", "_page"],
            aControlAggregation   = null,
            oControlBinding       = null,
            aValidateProperties   = ["value", "selectedKey", "text"], // yes, I want to validate Select and Text controls too
            isValidatedControl    = false,
            oExternalValue, oInternalValue,
            i, j, editable;

        // only validate controls and elements which have a 'visible' property
        // and are visible controls (invisible controls make no sense checking)
        if (( oControl instanceof sap.ui.core.Control 
	          || oControl instanceof sap.ui.layout.form.FormContainer
	          || oControl instanceof sap.ui.layout.form.FormElement
            ) && oControl.getVisible() ) {
           
            // check control for any properties worth validating 
            for (i = 0; i < aValidateProperties.length; i += 1) {
                if (oControl.getBinding(aValidateProperties[i]) 
                    	// check if a data type exists (which may have validation constraints)
                        && oControl.getBinding(aValidateProperties[i]).getType() 
                        ) {
                	try { editable = oControl.getProperty("editable"); }
                	catch (ex) { editable = true; }
                    
                    if(editable) {
	                    try { // try validating the bound value
	                        oControlBinding = oControl.getBinding(aValidateProperties[i]);
	                        oExternalValue  = oControl.getProperty(aValidateProperties[i]);
	                        oInternalValue  = oControlBinding.getType().parseValue(oExternalValue, oControlBinding.sInternalType);
	                        oControlBinding.getType().validateValue(oInternalValue);
	                    }
	                    
	                    catch (ex) { // catch any validation errors
	                        this._isValid = false;
	                        oControl.setValueState(ValueState.Error);
	
	                        oControlBinding = oControl.getBinding(aValidateProperties[i]);
	                        sap.ui.getCore().getMessageManager().addMessages(
	                            new Message({
	                                message  : ex.message,
	                                type     : MessageType.Error,
	                                target   : ( oControlBinding.getContext() ? oControlBinding.getContext().getPath() + "/" : "") +
	                                        oControlBinding.getPath(),
	                                processor: oControl.getBinding(aValidateProperties[i]).getModel()
	                            })
	                        );
	                    }
	
	                    isValidatedControl = true;
                    }

                } else if (oControl.getRequired 
                        && oControl.getRequired() === true ) {
                    try {
                        oControlBinding = oControl.getBinding(aValidateProperties[i]);
                        oExternalValue = oControl.getProperty(aValidateProperties[i]);
                        
                        if (!oExternalValue || oExternalValue==="") {
                            this._isValid = false;
                            var oMessage = "Please fill this mandatory field!";
                            oControl.setValueState(ValueState.Error, oMessage);
                            
                            sap.ui.getCore().getMessageManager().addMessages(
                                new Message({
                                    message: oMessage,
                                    type: MessageType.Error,
                                    target : ( oControlBinding.getContext() ? oControlBinding.getContext().getPath() + "/" : "") +
                                    oControlBinding.getPath(),
                                    processor: oControl.getBinding(aValidateProperties[i]).getModel()
                                })
                            );
                        } else if (oControl.getAggregation("picker") 
                                && oControl.getProperty("selectedKey").length === 0 ) { // might be a select 
                            this._isValid = false;
                            //TODO: i18n this
                            oControl.setValueState(ValueState.Error, "Please choose an entry!");
                        } else {
                            oControl.setValueState(ValueState.None);
			    break;
                        }
                    } catch (ex) {
                        // Validation failed
                    }
                } else {
                    //oControl.setValueState(ValueState.None);
                }
            }

	    // Control custom validation
	    if (oControl.getValueState && oControl.getValueState() === sap.ui.core.ValueState.Error) {
	        this._isValid = false;
		oMessage = (oControl.getValueStateText && oControl.getValueStateText()) ? oControl.getValueStateText() : "Wrong input";

		sap.ui.getCore().getMessageManager().addMessages(
                    new Message({
                        message: oMessage,
                        type: MessageType.Error
                    })
                );

		isValidatedControl = true;
	    }

            // if the control could not be validated, it may have aggregations
            if (!isValidatedControl) {
                for (i = 0; i < aPossibleAggregations.length; i += 1) {
                    aControlAggregation = oControl.getAggregation(aPossibleAggregations[i]);

                    if (aControlAggregation) {
                        // generally, aggregations are of type Array
                        if (aControlAggregation instanceof Array) {
                            for (j = 0; j < aControlAggregation.length; j += 1) {
                                this._validate(aControlAggregation[j]);
                            }
                        }
                        // ...however, with sap.ui.layout.form.Form, it is a single object *sigh*
                        else {
                            this._validate(aControlAggregation);
                        }
                    }
                }
            }
            
        }
        this._isValidationPerformed = true;
    };

    return Validator;
});
