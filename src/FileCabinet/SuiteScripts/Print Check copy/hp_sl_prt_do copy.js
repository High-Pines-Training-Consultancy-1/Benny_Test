/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */

define([
  "N/record",
  "N/config",
  "N/render",
  "N/email",
  "N/search",
  "N/format",
  "N/file",
  "N/runtime",
  "N/url",
], (
  record,
  nlConfig,
  nlRender,
  nlEmail,
  nlSearch,
  nlFormat,
  nlFile,
  runtime,
  url
) => {
  //
  //  Define constant value
  //
  const SO_PDF_TEMPLATE_ID = "CUSTTMPL_HAJRIS_CHECK_PRINOUT";

  //
  //  Get Function defined
  //
  const getFunction = (context) => {
    const request = context.request;
    const response = context.response;
    if (request.method === "GET") {
      try {
        const transactionId = Number(request.parameters.ifid);
        const transactionType = request.parameters.custom_type;

        log.audit("Transaction Info", { transactionId, transactionType });

        var objRecord = record.load({
          type: record.Type.SALES_ORDER,
          id: transactionId,
          isDynamic: false,
        });

        var value = objRecord.getValue({
          fieldId: "entity",
        });

        // Build the URL for a new cash sale
        const cashSaleUrl = url.resolveRecord({
          recordType: "cashsale",
          isEditMode: true,
        });

        // Add customer as parameter
        const redirectUrl = `${cashSaleUrl}&entity=${value}`;

        // Open in new tab
        window.open(redirectUrl, "_blank");


      } catch (e) {
        log.error("Error rendering transaction", e);
        response.write(`Error: ${e.name || e.message}`);
      }
    }
  };

  /**
   * Defines the Suitelet script trigger point.
   * @param {Object} scriptContext
   * @param {ServerRequest} scriptContext.request - Incoming request
   * @param {ServerResponse} scriptContext.response - Suitelet response
   * @since 2015.2
   */
  const onRequest = (scriptContext) => {
    if (scriptContext.request.method === "GET") {
      getFunction(scriptContext);

      const remainingUsage = runtime.getCurrentScript().getRemainingUsage();
      log.audit("Remaining Governance Units", remainingUsage);
    }
  };

  return { onRequest };
});
