/**
 /**
 * @NApiVersion 2.1
 * @NScriptType MassUpdateScript
 */
define(["N/record", "N/search"], /**
 * @param{record} record
 * @param{search} search
 */ (record, search) => {
  /**
   * Defines the Mass Update trigger point.
   * @param {Object} params
   * @param {string} params.type - Record type of the record being processed
   * @param {number} params.id - ID of the record being processed
   * @since 2016.1
   */
  const each = (params) => {
    const customerId = params.id;
    const customer = record.load({
      type: record.Type.CUSTOMER,
      id: customerId,
      isDynamic: false,
    });

    // Get a field directly from the addressbook sublist
    const labelValue = customer.getSublistValue({
      sublistId: "addressbook",
      fieldId: "label",
      line: 0,
    });

    // Get the subrecord (addressbookaddress) from the same sublist line
    const subrec = customer.getSublistSubrecord({
      sublistId: "addressbook",
      fieldId: "addressbookaddress",
      line: 0,
    });

    subrec.setValue({
      fieldId: "override",
      value: false,
    });
    customer.save({
      enableSourcing: false,
      ignoreMandatoryFields: true,
    });
  };

  return { each };
});
